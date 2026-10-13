/* KanaPet — main application logic. Vanilla JS, offline-first, localStorage persistence. */
(function () {
  'use strict';
  var STORAGE_KEY = 'kanapet_v1';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- State & storage ---------------- */
  function defaultState() {
    return {
      settings: {
        userName: 'Learner', petName: 'Mochi', dailyGoal: 20, sessionSize: 20,
        sets: { hiraganaBasic: true, katakanaBasic: false, hiraganaDakuten: false, katakanaDakuten: false, hiraganaHandakuten: false, katakanaHandakuten: false, yoon: false, n5: false, n4: false, n5read: false },
        romajiHint: 'on', showRomaji: true, autoAdvance: true, autoplayAudio: true, voiceOn: true, soundOn: true, hapticOn: true
      },
      stats: { xp: 0, level: 1, streak: 0, lastSessionDate: '', totalSessions: 0, totalCorrect: 0, totalAnswered: 0,
               learned: {}, correctStreak: {}, activity: {} },
      errors: {}, // key -> {count, correctStreak, kana, romaji, type, group}
      history: [] // {kana, romaji, correct, ts, type, group}, newest first, capped 500
    };
  }
  var state = load();
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      var d = defaultState();
      // shallow-merge to tolerate old versions
      s.settings = Object.assign({}, d.settings, s.settings || {});
      s.settings.sets = Object.assign({}, d.settings.sets, (s.settings && s.settings.sets) || {});
      // migrate legacy combined dakuten/handakuten toggles → per-script sets
      var sets = s.settings.sets;
      if (sets.dakuten) { sets.hiraganaDakuten = true; sets.katakanaDakuten = true; }
      if (sets.handakuten) { sets.hiraganaHandakuten = true; sets.katakanaHandakuten = true; }
      delete sets.dakuten; delete sets.handakuten;
      s.stats = Object.assign({}, d.stats, s.stats || {});
      s.errors = s.errors || {};
      return s;
    } catch (e) { return defaultState(); }
  }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function yesterdayStr() { var d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  /* ---------------- Audio: TTS + SFX (WebAudio, no files) ---------------- */
  var audioCtx = null;
  function beep(freqs, dur) {
    if (!state.settings.soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach(function (f, i) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime + i * dur);
        g.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + i * dur + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + i * dur + dur);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + i * dur); o.stop(audioCtx.currentTime + i * dur + dur + 0.05);
      });
    } catch (e) {}
  }
  function vibrate(p) { if (state.settings.hapticOn && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }
  function speakKana(text) {
    try {
      if (!('speechSynthesis' in window)) return;
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP'; u.rate = 0.85;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------------- Voice recognition (3-tier: native Capacitor plugin → Web Speech → self-rated) ---------------- */
  var WebSR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var recognition = null, listening = false, nativeListener = null, nativeErrListener = null;
  // Native plugin (works in the APK, and OFFLINE if the Japanese offline voice pack is installed)
  function nativeSR() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SpeechRecognition) || null;
  }
  function voiceEngine() {
    if (!state.settings.voiceOn) return null;
    if (nativeSR()) return 'native';
    if (WebSR) return 'web';
    return null;
  }
  function voiceAvailable() { return !!voiceEngine(); }

  function levenshtein(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    if (!m) return n; if (!n) return m;
    for (i = 0; i <= m; i++) d[i] = [i];
    for (j = 0; j <= n; j++) d[0][j] = j;
    for (j = 1; j <= n; j++) for (i = 1; i <= m; i++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function normalize(s) {
    return (s || '').toLowerCase()
      .replace(/[ー–—~～\-]/g, '')            // long-vowel marks / dashes recognizers add
      .replace(/[\s\.\,\!\?\。\、\「\」\『\』\[\]()"]/g, '');
  }
  function fuzzyMatch(transcript, entry) {
    var t = normalize(transcript);
    if (!t) return false;
    var expHira = KANA.expectedHira(entry).replace(/ー/g, '');
    var tHira = KANA.toHiragana(t);
    // script match (hiragana/katakana recognized, either script)
    if (tHira === expHira) return true;
    if (tHira.indexOf(expHira) === 0 && tHira.length <= expHira.length + 2) return true;
    // multi-character readings may appear inside a longer utterance
    if (expHira.length >= 2 && tHira.indexOf(expHira) !== -1) return true;
    // romaji variants with edit-distance tolerance
    var accepted = entry.accepted.slice();
    for (var i = 0; i < accepted.length; i++) {
      var a = accepted[i];
      if (t === a) return true;
      if (t.indexOf(a) === 0 || a.indexOf(t) === 0) return true;
      if (a.length >= 2 && t.length >= 2 && levenshtein(t, a) <= 1) return true;
    }
    return false;
  }

  function stopNativeListeners() {
    try { if (nativeListener && nativeListener.remove) nativeListener.remove(); } catch (e) {}
    try { if (nativeErrListener && nativeErrListener.remove) nativeErrListener.remove(); } catch (e) {}
    nativeListener = null; nativeErrListener = null;
  }
  function startListening(entry) {
    var status = $('#voice-status');
    var engine = voiceEngine();
    if (!engine) { status.textContent = 'Voice unavailable — use Got it / Missed below.'; return; }
    if (listening) { try { stopListening(); } catch (e) {} return; }
    var mic = $('#mic-btn');
    listening = true;
    mic.classList.add('listening');
    var finished = false;
    function release() {
      listening = false; mic.classList.remove('listening');
      stopNativeListeners();
    }
    function finish(ok, heard) {
      if (finished) return; finished = true;
      release();
      if (heard) status.textContent = 'Heard: "' + heard + '" — ' + (ok ? 'Correct!' : 'Not quite.');
      handleAnswer(ok, !!ok); // voice-correct always auto-advances
    }
    function fail(msg) {
      if (finished) return; finished = true;
      release();
      status.textContent = msg;
    }

    if (engine === 'native') {
      var NSR = nativeSR();
      var label = 'say "' + entry.romaji + '"';
      status.textContent = 'Listening… ' + label;
      var seen = [];
      var attempts = 0, maxAttempts = 5;
      var retryTimer = null;
      function matchIn(matches) {
        matches = matches || [];
        if (matches.length) seen = matches;
        for (var i = 0; i < matches.length; i++) {
          if (fuzzyMatch(matches[i], entry)) {
            try { NSR.stop(); } catch (e) {}
            finish(true, matches[i]);
            return true;
          }
        }
        return false;
      }
      function startOnce() {
        if (finished) return;
        // partialResults:true resolves immediately; results/errors arrive via listeners
        NSR.start({ language: 'ja-JP', maxResults: 5, popup: false, partialResults: true, preferOffline: true })
          .catch(function () {});
      }
      function onStopped() {
        if (finished) return;
        if (retryTimer) clearTimeout(retryTimer);
        // give the final result a moment to arrive, then decide
        retryTimer = setTimeout(function () {
          if (finished) return;
          if (seen.length) { finish(false, seen[0]); return; }              // heard something else → miss
          if (attempts < maxAttempts) { attempts++; startOnce(); }          // early end / silence → keep listening
          else fail('Didn’t hear you — tap the mic and ' + label + ' clearly.');
        }, 650);
      }
      Promise.resolve(NSR.requestPermissions ? NSR.requestPermissions() : {}).then(function (perm) {
        var p = perm && perm.speechRecognition;
        if (p && p !== 'granted') { fail('Microphone permission denied — enable it in Settings, or use Got it / Missed.'); return; }
        NSR.addListener('partialResults', function (d) { matchIn(d && d.matches); }).then(function (h) { nativeListener = h; });
        NSR.addListener('listeningState', function (st) {
          if (finished || !st) return;
          if (st.status === 'started') status.textContent = 'Listening… ' + label;
          else if (st.status === 'stopped') onStopped();
        }).then(function (h) { nativeErrListener = h; });
        attempts = 1;
        startOnce();
      }).catch(function (err) {
        var msg = typeof err === 'string' ? err : (err && err.message) || '';
        if (/permission/i.test(msg)) fail('Microphone permission denied — use Got it / Missed.');
        else fail('Voice unavailable (' + (msg || 'unknown') + '). Use Got it / Missed.');
      });
      // absolute hard stop
      setTimeout(function () {
        if (finished) return;
        try { NSR.stop(); } catch (e) {}
        if (seen.length) finish(false, seen[0]);
        else fail('Didn’t catch that — tap the mic and ' + label + '.');
      }, 15000);
      return;
    }

    // Web Speech API fallback (browser / online)
    try {
      recognition = new WebSR();
      recognition.lang = 'ja-JP';
      recognition.interimResults = false;
      recognition.maxAlternatives = 5;
      status.textContent = 'Listening… say the reading aloud!';
      recognition.onresult = function (e) {
        var matched = false, heard = [];
        for (var i = 0; i < e.results[0].length; i++) {
          var tr = e.results[0][i].transcript;
          heard.push(tr);
          if (fuzzyMatch(tr, entry)) matched = true;
        }
        finish(matched, heard[0] || '');
      };
      recognition.onerror = function (e) {
        var msg = e.error === 'not-allowed' ? 'Microphone denied — using self-rated buttons.' : 'Voice error (' + e.error + ') — try again or use buttons.';
        fail(msg);
        if (e.error === 'not-allowed' || e.error === 'service-not-found') { state.settings.voiceOn = false; save(); renderControls(); }
      };
      recognition.onend = function () {
        listening = false; mic.classList.remove('listening');
        if (!finished) { status.textContent = 'Didn\'t catch that — try again or use Got it / Missed.'; finished = true; }
      };
      recognition.start();
      setTimeout(function () { if (listening) { try { recognition.stop(); } catch (e) {} } }, 10000);
    } catch (e) {
      fail('Voice unavailable — use Got it / Missed below.');
    }
  }

  function stopListening() {
    if (!listening) return;
    listening = false;
    var mic = $('#mic-btn'); if (mic) mic.classList.remove('listening');
    try { if (recognition) recognition.abort(); } catch (e) {}
    var NSR = nativeSR();
    try { if (NSR) NSR.stop(); } catch (e) {}
    stopNativeListeners();
  }

  /* ---------------- Session / deck ---------------- */
  var session = null; // {deck:[entries], correct, total, fromReview, phase:'idle'|'feedback', timers:[]}
  var rafId = null;

  function selectedPool() {
    var s = state.settings.sets;
    return KANA.ALL.filter(function (e) {
      if (e.group === 'basic') {
        if (e.type === 'hiragana' && s.hiraganaBasic) return true;
        if (e.type === 'katakana' && s.katakanaBasic) return true;
        return false;
      }
      if (e.group === 'dakuten' && e.type === 'hiragana' && s.hiraganaDakuten) return true;
      if (e.group === 'dakuten' && e.type === 'katakana' && s.katakanaDakuten) return true;
      if (e.group === 'handakuten' && e.type === 'hiragana' && s.hiraganaHandakuten) return true;
      if (e.group === 'handakuten' && e.type === 'katakana' && s.katakanaHandakuten) return true;
      if (e.group === 'yoon' && s.yoon) return true;
      if (e.group === 'n5' && s.n5) return true;
      if (e.group === 'n4' && s.n4) return true;
      if (e.group === 'n5read' && s.n5read) return true;
      return false;
    });
  }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  function startSession(pool, fromReview) {
    var n = Math.min(state.settings.sessionSize, pool.length);
    var deck = shuffle(pool.slice()).slice(0, n);
    if (deck.length === 0) { toast(window.I18n ? window.I18n.t('noSetsSelected') : 'No characters selected — pick sets in Profile.'); return; }
    session = { deck: deck, correct: 0, total: 0, fromReview: !!fromReview, phase: 'idle', timers: [] };
    $('#start-panel').classList.add('hidden');
    $('#summary-panel').classList.add('hidden');
    $('#deck-area').classList.remove('hidden');
    renderDeck();
    renderControls();
    updateSessionProgress();
  }
  function clearSessionTimers() { if (session) session.timers.forEach(function (t) { clearTimeout(t); }); if (session) session.timers = []; }

  function fillCard(el, entry, depth) {
    if (!entry) { el.style.display = 'none'; return; }
    // full state reset — kills stale transform/opacity/transition that cause overlap
    el.style.display = '';
    el.style.transition = 'none';
    el.style.opacity = '';
    el.classList.remove('flipped', 'flash-good', 'flash-bad', 'rise-in');
    el.dataset.key = entry.key;
    var hintMode = state.settings.romajiHint;
    var cs = state.stats.correctStreak[entry.key] || 0;
    var isReading = entry.group === 'n5read'; // reading test: don't spoil the answer on the front
    var showHint = state.settings.showRomaji && !isReading && (hintMode === 'on' || (hintMode === 'auto' && cs < 3));
    var hideRom = !state.settings.showRomaji;
    var romStyle = hideRom ? ' style="display:none"' : '';
    var groupLabel = entry.group === 'basic' ? (entry.type === 'hiragana' ? (window.I18n?window.I18n.t('hiragana'):'Hiragana') : (window.I18n?window.I18n.t('katakana'):'Katakana')) :
      entry.group === 'dakuten' ? (window.I18n ? window.I18n.t('hiraganaDakuten') : 'Dakuten (ten-ten)') : entry.group === 'handakuten' ? (window.I18n ? window.I18n.t('hiraganaMaru') : 'Handakuten (maru)') :
      entry.group === 'n5' ? (window.I18n?window.I18n.t('n5Vocab'):'JLPT N5 vocab') : entry.group === 'n4' ? (window.I18n?window.I18n.t('n4Vocab'):'JLPT N4 vocab') :
      entry.group === 'n5read' ? (window.I18n?window.I18n.t('n5Reading'):'N5 reading (kana)') : (window.I18n ? (window.I18n.getLang()==='bn' ? window.I18n.t('yoon') : 'Yōon') : 'Yōon');
    var typeLabel = entry.type === 'vocab' ? (window.I18n ? window.I18n.t('vocab') : 'Vocab') : entry.type === 'reading' ? (window.I18n ? window.I18n.t('reading') : 'Reading') : entry.type;
    var fitFront = fitKana(el, entry.kana, 120);
    var fitBack = fitKana(el, entry.kana, 78);
    var fitRom = fitRomaji(el, entry.romaji, 28);
    var fitHint = fitRomaji(el, entry.romaji, 18);
    el.innerHTML =
      '<div class="card-flip">' +
        '<div class="face front">' +
          '<span class="type-tag">' + typeLabel + '</span>' +
          '<span class="group-tag">' + groupLabel + '</span>' +
          '<p class="kana-big jp" style="font-size:' + fitFront + 'px">' + entry.kana + '</p>' +
          '<p class="romaji-hint" style="font-size:' + fitHint + 'px">' + (showHint ? entry.romaji : '&nbsp;') + '</p>' +
          '<span class="tap-hint">Tap card to reveal · swipe to skip</span>' +
          '<button class="speaker-btn" data-speak="' + entry.kana + '" aria-label="Play audio">' + speakerIcon() + '</button>' +
        '</div>' +
        '<div class="face back">' +
          '<span class="type-tag">' + entry.type + '</span>' +
          '<p class="kana-big jp" style="font-size:' + fitBack + 'px">' + entry.kana + '</p>' +
          '<p class="romaji" style="font-size:' + fitRom + 'px"' + romStyle + '>' + entry.romaji + '</p>' +
          (isReading ? '' : '<p class="ex-word jp">' + entry.example.word + '</p>') +
          (isReading ? '' : '<p class="ex-romaji" style="font-size:' + Math.min(fitRom, 14) + 'px"' + romStyle + '>' + entry.example.romaji + '</p>') +
          '<p class="ex-meaning">"' + (window.MEANINGS_BN && window.I18n && window.I18n.getLang()==='bn' && window.MEANINGS_BN[entry.example.meaning] ? window.MEANINGS_BN[entry.example.meaning] : (window.MEANINGS_BN && window.I18n && window.I18n.getLang()==='bn' ? (entry.example.meaning_bn||entry.example.meaning) : entry.example.meaning)) + '"</p>' +
          '<button class="speaker-btn" data-speak="' + entry.kana + '" aria-label="Play audio">' + speakerIcon() + '</button>' +
        '</div>' +
      '</div>';
    // stacked depth transform
    var sc = depth === 0 ? 1 : depth === 1 ? 0.92 : 0.84;
    var ty = depth === 0 ? 0 : depth === 1 ? 14 : 28;
    el.style.transform = 'scale(' + sc + ') translateY(' + ty + 'px)';
    el.style.zIndex = 3 - depth;
    el.style.opacity = depth > 2 ? 0 : 1;
  }
  function speakerIcon() { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>'; }

  // Kana glyph "width unit": full-width kana = 1em, narrow marks (ー っ ゃ ゅ ょ,
  // small vowels, dakuten/handakuten) are fractionally narrower. Used to shrink
  // long reading words so they always fit the card instead of overflowing.
  function kanaUnits(str) {
    var narrow = { 'ー': .55, 'っ': .55, 'ゃ': .55, 'ゅ': .55, 'ょ': .55, 'ぁ': .55, 'ぃ': .55, 'ぅ': .55, 'ぇ': .55, 'ぉ': .55, 'ゎ': .55, 'ゕ': .55, 'ゖ': .55, '゛': .15, '゜': .15 };
    var u = 0;
    for (var i = 0; i < str.length; i++) u += narrow[str[i]] || 1;
    return u;
  }
  // Pick a font-size so the word fits the card width, never exceeding basePx.
  function fitKana(el, kana, basePx) {
    var avail = Math.max(el.offsetWidth - 64, 180); // card width minus face padding + safety
    var fit = Math.floor(avail / Math.max(kanaUnits(kana), 1));
    return Math.max(16, Math.min(basePx, fit));
  }
  // Same fit for romaji (average glyph ≈ 0.55em in bold Baloo 2).
  function fitRomaji(el, romaji, basePx) {
    var avail = Math.max(el.offsetWidth - 72, 170);
    var fit = Math.floor(avail / Math.max(romaji.length * 0.55, 1));
    return Math.max(11, Math.min(basePx, fit));
  }

  function renderDeck() {
    if (!session) return;
    fillCard($('#card0'), session.deck[0], 0);
    fillCard($('#card1'), session.deck[1], 1);
    fillCard($('#card2'), session.deck[2], 2);
    // next card springs up from the stack (smooth physics, masks any overlap)
    var c0 = $('#card0');
    c0.classList.add('rise-in');
    setTimeout(function () { c0.classList.remove('rise-in'); }, 320);
  }

  function currentEntry() { return session && session.deck[0]; }

  function updateSessionProgress() {
    if (!session) return;
    var done = session.total, total = session.total + session.deck.length;
    $('#session-count').textContent = done + ' / ' + total;
    $('#session-bar').style.width = (total ? (done / total) * 100 : 0) + '%';
  }

  function eyeIcon() { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'; }
  function eyeOffIcon() { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'; }

  function renderControls() {
    var va = voiceAvailable();
    $('#mic-btn').style.display = va ? '' : 'none';
    var revealed = session && session.phase === 'revealed';
    $('#next-btn').style.display = revealed ? '' : 'none';
    var dim = revealed ? '0.45' : '1';
    $('#missed-btn').style.opacity = dim;
    $('#got-it-btn').style.opacity = dim;
    $('#skip-btn').style.opacity = dim;
    var rt = $('#romaji-toggle');
    if (rt) rt.innerHTML = state.settings.showRomaji ? eyeIcon() : eyeOffIcon();
    $('#voice-status').textContent = va ? 'Tap mic & say the reading, or self-rate below.' : 'Voice off / unavailable — self-rate below.';
  }

  /* ---------------- Answer handling ---------------- */
  function flashScreen(kind) {
    var f = $('#screen-flash');
    f.className = 'screen-flash ' + kind; void f.offsetWidth;
    setTimeout(function () { f.className = 'screen-flash'; }, 550);
  }
  function showResultBadge(ok) {
    var b = $('#result-badge');
    b.innerHTML = ok ? checkIcon() : crossIcon();
    b.style.color = ok ? 'var(--good)' : 'var(--bad)';
    b.style.left = ok ? '18%' : '62%';
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    setTimeout(function () { b.classList.remove('show'); }, 900);
  }
  function checkIcon() { return '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'; }
  function crossIcon() { return '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'; }

  function scheduleAdvance(delay, force) {
    if (state.settings.autoAdvance || force) {
      session.timers.push(setTimeout(function () { flingAndAdvance(); }, delay));
    } else {
      session.phase = 'revealed'; // answer stays on screen until user taps Next
      renderControls();
    }
  }

  function handleAnswer(correct, forceAdvance) {
    if (!session || (session.phase !== 'idle' && session.phase !== 'skipping')) return;
    var entry = currentEntry();
    if (!entry) return;
    session.phase = 'feedback';
    session.total++;
    var today = todayStr();
    state.stats.activity[today] = (state.stats.activity[today] || 0) + 1;

    if (correct) {
      session.correct++;
      state.stats.totalCorrect++;
      state.stats.learned[entry.key] = (state.stats.learned[entry.key] || 0) + 1;
      state.stats.correctStreak[entry.key] = (state.stats.correctStreak[entry.key] || 0) + 1;
      addXP(10);
      // graduate from error list after 3 correct in a row
      if (state.errors[entry.key]) {
        state.errors[entry.key].correctStreak = (state.errors[entry.key].correctStreak || 0) + 1;
        if (state.errors[entry.key].correctStreak >= 3) delete state.errors[entry.key];
      }
      flashScreen('good'); showResultBadge(true); beep([523, 784], 0.12); vibrate(40);
      if (window.Pet) Pet.happy();
      $('#card0').classList.add('flash-good');
      // reveal answer briefly
      $('#card0').classList.add('flipped');
      if (state.settings.autoplayAudio) speakKana(entry.kana);
      scheduleAdvance(800, forceAdvance);
    } else {
      state.stats.correctStreak[entry.key] = 0;
      var er = state.errors[entry.key] || { count: 0, correctStreak: 0, kana: entry.kana, romaji: entry.romaji, type: entry.type, group: entry.group };
      er.count++; er.correctStreak = 0;
      state.errors[entry.key] = er;
      flashScreen('bad'); showResultBadge(false); beep([220, 180], 0.16); vibrate([80, 40, 80]);
      if (window.Pet) Pet.sad();
      $('#card0').classList.add('flash-bad', 'flipped'); // reveal correct reading
      if (state.settings.autoplayAudio) speakKana(entry.kana);
      scheduleAdvance(1600);
    }
    state.stats.totalAnswered++;
    state.history.unshift({ kana: entry.kana, romaji: entry.romaji, correct: correct, ts: Date.now(), type: entry.type, group: entry.group });
    if (state.history.length > 500) state.history.length = 500;
    save();
    updateBadge();
    updateSessionProgress();
  }

  function addXP(n) {
    var before = state.stats.level;
    state.stats.xp += n;
    state.stats.level = Math.floor(state.stats.xp / 100) + 1;
    if (state.stats.level > before) {
      toast('Level up! You are now level ' + state.stats.level + '! ' + (state.stats.level >= 3 ? state.settings.petName + ' got a new accessory!' : ''));
      if (window.Pet) Pet.setLevel(state.stats.level);
    }
    $('#xp-num').textContent = state.stats.xp;
    $('#lvl-num').textContent = state.stats.level;
  }

  function flingAndAdvance() {
    var c0 = $('#card0');
    animateTransform(c0, 'translateY(-130%) rotate(14deg) scale(.9)', 280, function () {
      if (!session) return;
      session.deck.shift();
      session.phase = 'idle';
      if (session.deck.length === 0) endSession();
      else { renderDeck(); renderControls(); }
    });
  }

  /* duration-interpolated transform animation (A1) */
  function animateTransform(el, targetStr, dur, onDone) {
    if (rafId) cancelAnimationFrame(rafId);
    var start = performance.now();
    // parse current transform as starting point; we just interpolate opacity/translate via CSS transition fallback
    el.style.transition = 'transform ' + dur + 'ms cubic-bezier(.2,.8,.3,1)';
    el.style.transform = targetStr;
    el.style.opacity = '0';
    var done = false;
    function finish() { if (done) return; done = true; el.style.transition = 'none'; el.style.opacity = ''; if (onDone) onDone(); }
    setTimeout(finish, dur + 60);
  }

  function endSession() {
    clearSessionTimers();
    var acc = session.total ? Math.round((session.correct / session.total) * 100) : 0;
    var mistakes = session.total - session.correct;
    state.stats.totalSessions++;
    // streak
    var today = todayStr();
    if (state.stats.lastSessionDate !== today) {
      if (state.stats.lastSessionDate === yesterdayStr()) state.stats.streak++;
      else state.stats.streak = 1;
      state.stats.lastSessionDate = today;
    }
    save();
    var msg = mistakes === 0 ? 'Perfect! Flawless session!' : mistakes <= 3 ? 'Great job! Just a few slips!' : 'Keep practicing! ' + state.settings.petName + ' believes in you!';
    $('#sum-accuracy').textContent = acc + '%';
    $('#sum-mistakes').textContent = mistakes;
    $('#sum-correct').textContent = session.correct + ' / ' + session.total;
    $('#sum-msg').textContent = msg;
    $('#deck-area').classList.add('hidden');
    $('#summary-panel').classList.remove('hidden');
    if (acc >= 80) { confettiBurst(); if (window.Pet) Pet.celebrate(); }
    else if (window.Pet) Pet.happy();
    session = null;
    updateBadge();
    renderProgress();
    renderReview();
    updateXPBar();
  }

  /* ---------------- Stop / abort an in-progress session ---------------- */
  function stopSession() {
    if (!session) return;
    clearSessionTimers();
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (listening) stopListening(); // cancel any active voice listening
    session = null;
    $('#stop-modal').classList.remove('show');
    $('#deck-area').classList.add('hidden');
    $('#summary-panel').classList.add('hidden');
    $('#start-panel').classList.remove('hidden');
    renderStartPanel();
    if (window.Pet) Pet.happy();
    toast('Session stopped — pick your sets and start again.');
  }

  /* ---------------- Swipe physics on top card ---------------- */
  function initSwipe() {
    var c0 = $('#card0');
    var startX = 0, startY = 0, dx = 0, dy = 0, dragging = false, startTime = 0, moved = false;
    c0.addEventListener('pointerdown', function (e) {
      if (!session || session.phase !== 'idle') return;
      if (e.target.closest('.speaker-btn')) return; // let speaker work
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY; startTime = performance.now();
      dx = 0; dy = 0;
      c0.classList.add('dragging');
      c0.style.transition = 'none';
      try { c0.setPointerCapture(e.pointerId); } catch (err) {}
    });
    c0.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dx = e.clientX - startX; dy = e.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
      var rot = dx * 0.08;
      c0.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)';
    });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      c0.classList.remove('dragging');
      var dt = Math.max(1, performance.now() - startTime);
      var vx = dx / dt, vy = dy / dt;
      var dist = Math.hypot(dx, dy);
      if (!moved) {
        // tap → flip card
        c0.style.transform = '';
        c0.classList.toggle('flipped');
        if (c0.classList.contains('flipped') && state.settings.autoplayAudio) {
          var en = currentEntry(); if (en) speakKana(en.kana);
        }
        return;
      }
      if (dist > 90 || Math.abs(vx) > 0.4 || Math.abs(vy) > 0.4) {
        // fling off in swipe direction → counts as skip (error)
        var rot = dx * 0.08;
        c0.style.transition = 'transform 260ms cubic-bezier(.2,.8,.3,1), opacity 260ms ease';
        c0.style.transform = 'translate(' + (dx * 3) + 'px,' + (dy * 3) + 'px) rotate(' + (rot * 3) + 'deg)';
        c0.style.opacity = '0';
        if (session) session.phase = 'skipping'; // lock against double-swipe overlap
        setTimeout(function () {
          c0.style.transition = 'none'; c0.style.opacity = ''; c0.style.transform = '';
          handleAnswer(false); // skip = error (commits stats + flings the next card)
        }, 270);
      } else {
        // spring back
        c0.style.transition = 'transform 220ms cubic-bezier(.2,1.4,.4,1)';
        c0.style.transform = '';
        setTimeout(function () { c0.style.transition = 'none'; }, 240);
      }
    }
    c0.addEventListener('pointerup', end);
    c0.addEventListener('pointercancel', end);
    // speaker buttons inside cards
    $('#deck').addEventListener('click', function (e) {
      var b = e.target.closest('[data-speak]');
      if (b) { e.stopPropagation(); speakKana(b.getAttribute('data-speak')); beep([600], 0.06); }
    });
  }

  /* ---------------- Confetti (canvas particles) ---------------- */
  var confettiTimer = null;
  function confettiBurst() {
    var cv = $('#confetti');
    var ctx = cv.getContext('2d');
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    var colors = ['#297a2e', '#d97706', '#ff8fab', '#7cc6f5', '#fbbf24'];
    var parts = [];
    for (var i = 0; i < 140; i++) {
      parts.push({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.5,
        vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, s: 5 + Math.random() * 7,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colors[i % colors.length], life: 1 });
    }
    if (confettiTimer) cancelAnimationFrame(confettiTimer);
    var t0 = performance.now();
    function frame(now) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      var alive = false;
      parts.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.vr;
        if (p.y < cv.height + 20 && now - t0 < 3500) {
          alive = true;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
        }
      });
      if (alive) confettiTimer = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    }
    confettiTimer = requestAnimationFrame(frame);
  }

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ---------------- Tabs ---------------- */
  function switchTab(name) {
    $$('.tab-page').forEach(function (p) { p.classList.remove('active'); });
    $('#tab-' + name).classList.add('active');
    $$('.tabbar button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    if (name === 'review') renderReview();
    if (name === 'progress') renderProgress();
    if (name === 'profile') renderProfile();
    if (name === 'learn') { if (!session) { $('#deck-area').classList.add('hidden'); $('#start-panel').classList.remove('hidden'); renderStartPanel(); } }
  }

  function updateBadge() {
    var n = Object.keys(state.errors).length;
    var b = $('#review-badge');
    b.textContent = n > 99 ? '99+' : n;
    b.style.display = n > 0 ? '' : 'none';
  }

  /* ---------------- Start panel ---------------- */
  function renderStartPanel() {
    var pool = selectedPool();
    $('#pool-count').textContent = pool.length;
    $('#session-size-info').textContent = state.settings.sessionSize;
    var today = state.stats.activity[todayStr()] || 0;
    $('#today-progress').textContent = today + ' / ' + state.settings.dailyGoal + ' today';
    $('#pet-name-start').textContent = state.settings.petName;
  }

  var reviewView = 'missed'; // 'missed' | 'history'
  function renderHistory() {
    var list = $('#history-list');
    list.innerHTML = '';
    var h = state.history || [];
    if (!h.length) { list.innerHTML = '<div class="empty-note">No history yet — answer cards to build your log.</div>'; return; }
    h.slice(0, 100).forEach(function (r) {
      var d = new Date(r.ts);
      var time = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      var tag = r.type === 'vocab' ? (r.group === 'n5' ? (window.I18n?window.I18n.t('n5Vocab'):'JLPT N5 vocab') : (window.I18n?window.I18n.t('n4Vocab'):'JLPT N4 vocab')) :
        r.type === 'reading' ? (window.I18n?window.I18n.t('n5Reading'):'N5 reading') : (window.I18n ? (window.I18n.t(r.type) || r.type) : r.type);
      var row = document.createElement('div');
      row.className = 'error-row';
      row.innerHTML = '<span class="k jp">' + r.kana + '</span>' +
        '<div class="info"><div class="r">' + r.romaji + '</div>' +
        '<div class="sub">' + tag + ' · ' + time + '</div></div>' +
        '<span class="miss" style="background:' + (r.correct ? 'rgba(22,163,74,.12)' : 'var(--accent2-soft)') + ';color:' + (r.correct ? 'var(--good)' : 'var(--accent2)') + '">' + (r.correct ? 'Got it' : 'Missed') + '</span>';
      list.appendChild(row);
    });
  }

  /* ---------------- Review tab ---------------- */
  function renderReview() {
    // segmented control active state + list visibility
    var segMissed = $('#seg-missed'), segHist = $('#seg-history');
    if (segMissed) segMissed.classList.toggle('active', reviewView === 'missed');
    if (segHist) segHist.classList.toggle('active', reviewView === 'history');
    $('#error-list').style.display = reviewView === 'missed' ? '' : 'none';
    $('#history-list').style.display = reviewView === 'history' ? '' : 'none';
    if (reviewView === 'history') { renderHistory(); return; }
    var list = $('#error-list');
    var keys = Object.keys(state.errors);
    keys.sort(function (a, b) { return state.errors[b].count - state.errors[a].count; });
    list.innerHTML = '';
    if (keys.length === 0) {
      list.innerHTML = '<div class="empty-note">No missed characters yet. ' + state.settings.petName + ' is proud of you!</div>';
      $('#practice-missed-btn').disabled = true;
      $('#practice-missed-btn').style.opacity = '0.5';
      return;
    }
    $('#practice-missed-btn').disabled = false;
    $('#practice-missed-btn').style.opacity = '';
    keys.forEach(function (k) {
      var er = state.errors[k];
      var row = document.createElement('div');
      row.className = 'error-row';
      row.innerHTML = '<span class="k jp">' + er.kana + '</span>' +
        '<div class="info"><div class="r">' + er.romaji + '</div>' +
        '<div class="sub">' + er.type + ' · ' + er.group + ' · ' + er.correctStreak + '/3 correct streak</div></div>' +
        '<span class="miss">' + er.count + '× missed</span>';
      list.appendChild(row);
    });
  }

  /* ---------------- Progress tab ---------------- */
  function masteryPct(filterFn) {
    var set = KANA.ALL.filter(filterFn);
    if (!set.length) return 0;
    var learned = set.filter(function (e) { return (state.stats.learned[e.key] || 0) > 0; }).length;
    return Math.round((learned / set.length) * 100);
  }
  function renderProgress() {
    $('#stat-streak').textContent = state.stats.streak;
    $('#stat-sessions').textContent = state.stats.totalSessions;
    $('#stat-learned').textContent = Object.keys(state.stats.learned).length;
    $('#stat-accuracy').textContent = state.stats.totalAnswered ? Math.round(state.stats.totalCorrect / state.stats.totalAnswered * 100) + '%' : '—';
    var bars = [
      ['mastery-hira', masteryPct(function (e) { return e.type === 'hiragana' && e.group === 'basic'; }), '#297a2e'],
      ['mastery-kata', masteryPct(function (e) { return e.type === 'katakana' && e.group === 'basic'; }), '#d97706'],
      ['mastery-hiradaku', masteryPct(function (e) { return e.group === 'dakuten' && e.type === 'hiragana'; }), '#7cc6f5'],
      ['mastery-katadaku', masteryPct(function (e) { return e.group === 'dakuten' && e.type === 'katakana'; }), '#5fb3e8'],
      ['mastery-hirahand', masteryPct(function (e) { return e.group === 'handakuten' && e.type === 'hiragana'; }), '#ff8fab'],
      ['mastery-katahand', masteryPct(function (e) { return e.group === 'handakuten' && e.type === 'katakana'; }), '#f48fb1']
    ];
    bars.forEach(function (b) {
      var el = $('#' + b[0]);
      el.firstElementChild.style.width = b[1] + '%';
      el.firstElementChild.style.background = b[2];
      el.nextElementSibling.textContent = b[1] + '%';
    });
    // heatmap last 30 days
    var hm = $('#heatmap');
    hm.innerHTML = '';
    for (var i = 29; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      var c = state.stats.activity[key] || 0;
      var cell = document.createElement('div');
      var lvl = c === 0 ? '' : c < 5 ? 'l1' : c < 15 ? 'l2' : c < 30 ? 'l3' : 'l4';
      cell.className = 'cell ' + lvl;
      cell.title = key + ': ' + c + ' cards';
      hm.appendChild(cell);
    }
  }

  /* ---------------- Profile / settings ---------------- */
  function renderProfile() {
    $('#set-username').value = state.settings.userName;
    $('#set-petname').value = state.settings.petName;
    if ($('#set-language')) $('#set-language').value = (localStorage.getItem('kanapet_lang') || 'en');
    $('#set-daily').value = state.settings.dailyGoal;
    $('#set-daily-val').textContent = state.settings.dailyGoal;
    $('#set-session').value = state.settings.sessionSize;
    $('#set-session-val').textContent = state.settings.sessionSize;
    $('#set-romaji').value = state.settings.romajiHint;
    $('#set-autoplay').checked = state.settings.autoplayAudio;
    $('#set-voice').checked = state.settings.voiceOn;
    $('#set-showromaji').checked = state.settings.showRomaji;
    $('#set-autoadvance').checked = state.settings.autoAdvance;
    $('#set-sound').checked = state.settings.soundOn;
    $('#set-haptic').checked = state.settings.hapticOn;
    ['hiraganaBasic', 'katakanaBasic', 'hiraganaDakuten', 'katakanaDakuten', 'hiraganaHandakuten', 'katakanaHandakuten', 'yoon', 'n5', 'n4', 'n5read'].forEach(function (k) {
      var c = $('[data-set="' + k + '"]');
      if (c) c.classList.toggle('on', !!state.settings.sets[k]);
    });
  }
  function bindSettings() {
    $('#set-username').addEventListener('change', function (e) { state.settings.userName = e.target.value || 'Learner'; save(); });
    $('#set-petname').addEventListener('change', function (e) {
      state.settings.petName = e.target.value || 'Mochi'; save();
      $('.pet-name-tag').textContent = state.settings.petName;
    });
    $('#set-daily').addEventListener('input', function (e) { state.settings.dailyGoal = +e.target.value; $('#set-daily-val').textContent = e.target.value; save(); });
    $('#set-session').addEventListener('input', function (e) { state.settings.sessionSize = +e.target.value; $('#set-session-val').textContent = e.target.value; save(); });
    $('#set-romaji').addEventListener('change', function (e) { state.settings.romajiHint = e.target.value; save(); });
    $('#set-autoplay').addEventListener('change', function (e) { state.settings.autoplayAudio = e.target.checked; save(); });
    $('#set-voice').addEventListener('change', function (e) { state.settings.voiceOn = e.target.checked; save(); renderControls(); });
    $('#set-showromaji').addEventListener('change', function (e) {
      state.settings.showRomaji = e.target.checked; save();
      if (session && session.phase === 'idle') renderDeck();
      renderControls();
      toast(e.target.checked ? (window.I18n?window.I18n.t('romajiShown'):'Romaji shown.') : (window.I18n?window.I18n.t('romajiHidden'):'Romaji hidden — practice by listening!'));
    });
    $('#set-autoadvance').addEventListener('change', function (e) { state.settings.autoAdvance = e.target.checked; save(); toast(e.target.checked ? 'Auto-advance on.' : 'Auto-advance off — tap Next to continue.'); });
    $('#set-sound').addEventListener('change', function (e) { state.settings.soundOn = e.target.checked; save(); });
    $('#set-haptic').addEventListener('change', function (e) { state.settings.hapticOn = e.target.checked; save(); });
    $$('[data-set]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var k = chip.dataset.set;
        state.settings.sets[k] = !state.settings.sets[k];
        chip.classList.toggle('on', state.settings.sets[k]);
        save();
      });
    });
    $('#mix-all').addEventListener('click', function () {
      ['hiraganaBasic', 'katakanaBasic', 'hiraganaDakuten', 'katakanaDakuten', 'hiraganaHandakuten', 'katakanaHandakuten', 'yoon', 'n5', 'n4', 'n5read'].forEach(function (k) {
        state.settings.sets[k] = true;
        $('[data-set="' + k + '"]').classList.add('on');
      });
      save(); toast('All character sets enabled!');
    });
    $('#view-charts').addEventListener('click', function () {
      var chartsModal = document.getElementById('charts-modal');
      if (chartsModal) {
        chartsModal.classList.add('show');
        if (window.Charts) window.Charts.render({ chart: 'all', search: '' });
      }
    });
    document.getElementById('charts-close').addEventListener('click', function () {
      var chartsModal = document.getElementById('charts-modal');
      if (chartsModal) chartsModal.classList.remove('show');
    });
    var chartChips = document.querySelectorAll('[data-chart]');
    var chartSearch = document.getElementById('chart-search');
    var chartClear = document.getElementById('chart-clear');
    var currentChart = 'all';
    chartChips.forEach(function(chip) {
      chip.addEventListener('click', function() {
        chartChips.forEach(function(c){ c.classList.remove('on'); });
        chip.classList.add('on');
        currentChart = chip.getAttribute('data-chart');
        if (window.Charts) window.Charts.render({ chart: currentChart, search: (chartSearch && chartSearch.value) || '' });
      });
    });
    if (chartSearch) {
      chartSearch.addEventListener('input', function() {
        if (window.Charts) window.Charts.render({ chart: currentChart, search: chartSearch.value });
      });
    }
    if (chartClear) {
      chartClear.addEventListener('click', function() {
        if (chartSearch) chartSearch.value = '';
        if (window.Charts) window.Charts.render({ chart: currentChart, search: '' });
      });
    }
    $('#reset-btn').addEventListener('click', function () { $('#reset-modal').classList.add('show'); });
    $('#reset-cancel').addEventListener('click', function () { $('#reset-modal').classList.remove('show'); });
    $('#reset-confirm').addEventListener('click', function () {
      localStorage.removeItem(STORAGE_KEY);
      state = load();
      $('#reset-modal').classList.remove('show');
      if (window.Pet) Pet.setLevel(1);
      updateXPBar(); updateBadge(); renderProfile(); renderProgress(); renderReview(); renderStartPanel();
      toast('Progress reset. Fresh start!');
    });
  }

  function updateXPBar() {
    $('#xp-num').textContent = state.stats.xp;
    $('#lvl-num').textContent = state.stats.level;
    $('.pet-name-tag').textContent = state.settings.petName;
    if (window.Pet) Pet.setLevel(state.stats.level);
  }

  /* ---------------- Boot ---------------- */
  function init() {
    // tab bar
    $$('.tabbar button').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    });
    // learn buttons
    $('#start-btn').addEventListener('click', function () { startSession(selectedPool(), false); });
    $('#again-btn').addEventListener('click', function () { startSession(selectedPool(), false); });
    $('#practice-missed-btn').addEventListener('click', function () {
      var pool = Object.keys(state.errors).map(function (k) { return KANA.byKey(k); }).filter(Boolean);
      if (pool.length) { switchTab('learn'); startSession(pool, true); }
    });
    $('#seg-missed').addEventListener('click', function () { reviewView = 'missed'; renderReview(); });
    $('#seg-history').addEventListener('click', function () { reviewView = 'history'; renderReview(); });
    $('#mic-btn').addEventListener('click', function () { var e = currentEntry(); if (e) startListening(e); });
    $('#got-it-btn').addEventListener('click', function () { handleAnswer(true); });
    $('#missed-btn').addEventListener('click', function () { handleAnswer(false); });
    $('#skip-btn').addEventListener('click', function () { if (session && session.phase === 'idle') { $('#voice-status').textContent = 'Skipped — counted as missed.'; handleAnswer(false); } });
    $('#stop-btn').addEventListener('click', function () { if (session) $('#stop-modal').classList.add('show'); });
    $('#stop-cancel').addEventListener('click', function () { $('#stop-modal').classList.remove('show'); });
    $('#stop-confirm').addEventListener('click', stopSession);
    $('#next-btn').addEventListener('click', function () { if (session && session.phase === 'revealed') flingAndAdvance(); });
    $('#romaji-toggle').addEventListener('click', function () {
      state.settings.showRomaji = !state.settings.showRomaji; save();
      if (session && session.phase === 'idle') renderDeck();
      renderControls();
      toast(state.settings.showRomaji ? (window.I18n?window.I18n.t('romajiShown'):'Romaji shown.') : (window.I18n?window.I18n.t('romajiHidden'):'Romaji hidden — practice by listening!'));
    });

    initSwipe();
    bindSettings();
    updateXPBar();
    updateBadge();
    renderStartPanel();
    renderControls();
    if (window.Pet) Pet.init();
    switchTab('learn');

    // Android back-button guard (Capacitor) — TODO: import @capacitor/app for full handler; web fallback:
    window.addEventListener('beforeunload', function () { clearSessionTimers(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
