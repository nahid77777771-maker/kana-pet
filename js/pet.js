/* KanaPet — virtual pet controller. The SVG itself is inline in index.html (#pet).
 * Idle behaviors: wander, blink, sit, stretch, chase a floating dot, sleep after 30s idle.
 * Reactive: happy (hearts), sad (droop + sweat drop), celebrate (spin + hop), accessory by level.
 */
(function () {
  'use strict';
  var petEl, habitat, dotEl, timers = [], lastActivity = Date.now(), sleeping = false, level = 1;

  function $(sel, root) { return (root || document).querySelector(sel); }

  function clearTimers() { timers.forEach(function (t) { clearTimeout(t); clearInterval(t); }); timers = []; }

  function setAccessory(lvl) {
    level = lvl;
    var hat = $('#pet-hat'), scarf = $('#pet-scarf');
    if (hat) hat.style.display = lvl >= 3 ? '' : 'none';
    if (scarf) scarf.style.display = lvl >= 5 ? '' : 'none';
  }

  function blink() {
    var eyes = $('#pet-eyes');
    if (!eyes) return;
    eyes.style.transition = 'transform .08s ease';
    eyes.setAttribute('transform', 'scale(1 0.1)');
    setTimeout(function () { eyes.setAttribute('transform', 'scale(1 1)'); }, 120);
  }

  function wander() {
    if (!petEl || !habitat) return;
    var w = habitat.clientWidth - 80;
    var x = Math.max(6, Math.random() * w);
    petEl.style.left = x + 'px';
  }

  function hop() {
    if (!petEl) return;
    petEl.classList.remove('hop'); void petEl.offsetWidth; petEl.classList.add('hop');
  }

  function spawnDot() {
    if (!habitat || !dotEl) return;
    var w = habitat.clientWidth - 20;
    dotEl.style.left = (10 + Math.random() * w) + 'px';
    dotEl.style.top = (14 + Math.random() * 30) + 'px';
    dotEl.style.opacity = '1';
    setTimeout(function () { if (dotEl) dotEl.style.opacity = '0'; }, 2600);
    // pet chases toward dot
    setTimeout(wander, 400);
  }

  // Floating effect particles. Each type has an emoji/symbol, a colour class,
  // and a count. Rendered as absolutely-positioned nodes that float up & fade.
  var FX = {
    heart:   { ch: '\u2665', cls: 'heart-fx',  n: 3 },
    star:    { ch: '\u2605', cls: 'star-fx',   n: 3 },
    note:    { ch: '\u266A', cls: 'note-fx',   n: 2 },
    sparkle: { ch: '\u2728', cls: 'star-fx',   n: 3 },
    anger:   { ch: '\uD83D\uDCA2', cls: 'anger-fx', n: 2 },
    sweat:   { ch: '\u25CF', cls: 'sweat-fx',  n: 1 }
  };
  function fx(type) {
    if (!petEl || !habitat) return;
    var cfg = FX[type] || FX.heart;
    for (var i = 0; i < cfg.n; i++) {
      (function (i) {
        var el = document.createElement('div');
        el.className = 'pet-fx ' + cfg.cls;
        el.textContent = cfg.ch;
        el.style.left = (parseFloat(petEl.style.left || '40') + 12 + i * 12) + 'px';
        el.style.top = (habitat.clientHeight - 66) + 'px';
        el.style.animationDelay = (i * 90) + 'ms';
        habitat.appendChild(el);
        setTimeout(function () { el.remove(); }, 1400);
      })(i);
    }
  }

  // Tap reactions — tap/click the pet and it plays a random one of these.
  var REACTIONS = [
    { cls: 'hop',    fx: 'heart',   say: 'Yay!' },
    { cls: 'spin',   fx: 'star',    say: 'Whee!' },
    { cls: 'wiggle', fx: 'note',    say: 'Hi hi!' },
    { cls: 'bounce', fx: 'heart',   say: 'Boing!' },
    { cls: 'dance',  fx: 'note',    say: '\u266A \u266A' },
    { cls: 'love',   fx: 'heart',   say: 'Love you!' },
    { cls: 'shy',    fx: 'sweat',   say: 'Hehe\u2026' },
    { cls: 'pop',    fx: 'sparkle', say: '!' },
    { cls: 'shake',  fx: 'anger',   say: 'Hmph!' },
    { cls: 'dizzy',  fx: 'star',    say: '@_@' }
  ];
  var lastReaction = -1;
  function bubble(text) {
    if (!petEl || !habitat || !text) return;
    var b = document.createElement('div');
    b.className = 'pet-say';
    b.textContent = text;
    b.style.left = parseFloat(petEl.style.left || '40') + 'px';
    habitat.appendChild(b);
    setTimeout(function () { b.remove(); }, 1300);
  }
  function react() {
    if (!petEl) return;
    wake();
    var i = Math.floor(Math.random() * REACTIONS.length);
    if (REACTIONS.length > 1 && i === lastReaction) i = (i + 1) % REACTIONS.length;
    lastReaction = i;
    var r = REACTIONS[i];
    REACTIONS.forEach(function (x) { petEl.classList.remove(x.cls); });
    void petEl.offsetWidth;
    petEl.classList.add(r.cls);
    fx(r.fx);
    bubble(r.say);
    setTimeout(function () { fx(r.fx); }, 280);
    setTimeout(function () { if (petEl) petEl.classList.remove(r.cls); }, 1200);
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
  }

  function sleep() {
    if (!petEl || sleeping) return;
    sleeping = true;
    petEl.classList.add('sleep');
  }
  function wake() {
    if (!petEl) return;
    sleeping = false;
    petEl.classList.remove('sleep');
    lastActivity = Date.now();
  }

  function happy() {
    wake(); fx('heart'); hop();
  }
  function sad() {
    wake();
    if (petEl) { petEl.classList.remove('sad'); void petEl.offsetWidth; petEl.classList.add('sad'); setTimeout(function () { petEl.classList.remove('sad'); }, 900); }
    fx('sweat');
  }
  function celebrate() {
    wake(); fx('heart');
    if (petEl) { petEl.classList.remove('spin'); void petEl.offsetWidth; petEl.classList.add('spin'); }
    setTimeout(hop, 350); setTimeout(fx, 600, 'heart');
  }

  function idleLoop() {
    // randomized idle behaviors
    var r = Math.random();
    if (Date.now() - lastActivity > 30000) { sleep(); return; }
    if (r < 0.35) wander();
    else if (r < 0.55) blink();
    else if (r < 0.7) { hop(); setTimeout(wander, 500); }
    else if (r < 0.85) spawnDot();
    else blink();
  }

  function start() {
    clearTimers();
    timers.push(setInterval(idleLoop, 2600));
    timers.push(setInterval(blink, 4200));
    // sleep check
    timers.push(setInterval(function () { if (Date.now() - lastActivity > 30000) sleep(); }, 5000));
  }

  function init() {
    petEl = $('#pet');
    habitat = $('.pet-habitat');
    if (!petEl || !habitat) return;
    dotEl = document.createElement('div');
    dotEl.className = 'float-dot';
    dotEl.style.opacity = '0';
    dotEl.style.transition = 'opacity .4s ease, left .8s ease, top .8s ease';
    habitat.appendChild(dotEl);
    start();
    // tap/click the pet → reaction (keyboard accessible too)
    petEl.addEventListener('click', react);
    petEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); react(); }
    });
    // user activity resets idle
    ['pointerdown', 'keydown'].forEach(function (ev) {
      document.addEventListener(ev, wake, { passive: true });
    });
  }

  window.Pet = {
    init: init, happy: happy, sad: sad, celebrate: celebrate,
    setLevel: setAccessory, touch: wake, react: react
  };
})();
