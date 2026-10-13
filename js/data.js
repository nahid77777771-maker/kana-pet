/* KanaPet — complete kana dataset (hard-coded, no placeholders).
 * Every entry: { key, kana, type: 'hiragana'|'katakana', romaji, group, example:{word,romaji,meaning} }
 * Groups: basic | dakuten | handakuten | yoon
 * Total: basic 92 (46+46) + dakuten 40 + handakuten 10 + yoon 66 = 208 characters.
 */
(function () {
  'use strict';

  // rows of [romaji, hiragana, katakana]
  var BASIC = [
    ['a','あ','ア'], ['i','い','イ'], ['u','う','ウ'], ['e','え','エ'], ['o','お','オ'],
    ['ka','か','カ'], ['ki','き','キ'], ['ku','く','ク'], ['ke','け','ケ'], ['ko','こ','コ'],
    ['sa','さ','サ'], ['shi','し','シ'], ['su','す','ス'], ['se','せ','セ'], ['so','そ','ソ'],
    ['ta','た','タ'], ['chi','ち','チ'], ['tsu','つ','ツ'], ['te','て','テ'], ['to','と','ト'],
    ['na','な','ナ'], ['ni','に','ニ'], ['nu','ぬ','ヌ'], ['ne','ね','ネ'], ['no','の','ノ'],
    ['ha','は','ハ'], ['hi','ひ','ヒ'], ['fu','ふ','フ'], ['he','へ','ヘ'], ['ho','ほ','ホ'],
    ['ma','ま','マ'], ['mi','み','ミ'], ['mu','む','ム'], ['me','め','メ'], ['mo','も','モ'],
    ['ya','や','ヤ'], ['yu','ゆ','ユ'], ['yo','よ','ヨ'],
    ['ra','ら','ラ'], ['ri','り','リ'], ['ru','る','ル'], ['re','れ','レ'], ['ro','ろ','ロ'],
    ['wa','わ','ワ'], ['wo','を','ヲ'], ['n','ん','ン']
  ];

  var DAKUTEN = [
    ['ga','が','ガ'], ['gi','ぎ','ギ'], ['gu','ぐ','グ'], ['ge','げ','ゲ'], ['go','ご','ゴ'],
    ['za','ざ','ザ'], ['ji','じ','ジ'], ['zu','ず','ズ'], ['ze','ぜ','ゼ'], ['zo','ぞ','ゾ'],
    ['da','だ','ダ'], ['di','ぢ','ヂ'], ['du','づ','ヅ'], ['de','で','デ'], ['do','ど','ド'],
    ['ba','ば','バ'], ['bi','び','ビ'], ['bu','ぶ','ブ'], ['be','べ','ベ'], ['bo','ぼ','ボ']
  ];

  var HANDAKUTEN = [
    ['pa','ぱ','パ'], ['pi','ぴ','ピ'], ['pu','ぷ','プ'], ['pe','ぺ','ペ'], ['po','ぽ','ポ']
  ];

  var YOON = [
    ['kya','きゃ','キャ'], ['kyu','きゅ','キュ'], ['kyo','きょ','キョ'],
    ['sha','しゃ','シャ'], ['shu','しゅ','シュ'], ['sho','しょ','ショ'],
    ['cha','ちゃ','チャ'], ['chu','ちゅ','チュ'], ['cho','ちょ','チョ'],
    ['nya','にゃ','ニャ'], ['nyu','にゅ','ニュ'], ['nyo','にょ','ニョ'],
    ['hya','ひゃ','ヒャ'], ['hyu','ひゅ','ヒュ'], ['hyo','ひょ','ヒョ'],
    ['mya','みゃ','ミャ'], ['myu','みゅ','ミュ'], ['myo','みょ','ミョ'],
    ['rya','りゃ','リャ'], ['ryu','りゅ','リュ'], ['ryo','りょ','リョ'],
    ['gya','ぎゃ','ギャ'], ['gyu','ぎゅ','ギュ'], ['gyo','ぎょ','ギョ'],
    ['ja','じゃ','ジャ'], ['ju','じゅ','ジュ'], ['jo','じょ','ジョ'],
    ['bya','びゃ','ビャ'], ['byu','びゅ','ビュ'], ['byo','びょ','ビョ'],
    ['pya','ぴゃ','ピャ'], ['pyu','ぴゅ','ピュ'], ['pyo','ぴょ','ピョ']
  ];

  // JLPT vocabulary starter sets (toggleable, like kana sets). [word, hiragana-reading, romaji, meaning]
  var VOCAB_N5 = [
    ['水','みず','mizu','water'], ['火','ひ','hi','fire'], ['山','やま','yama','mountain'],
    ['川','かわ','kawa','river'], ['空','そら','sora','sky'], ['花','はな','hana','flower'],
    ['木','き','ki','tree'], ['本','ほん','hon','book'], ['人','ひと','hito','person'],
    ['子供','こども','kodomo','child'], ['男','おとこ','otoko','man'], ['女','おんな','onna','woman'],
    ['犬','いぬ','inu','dog'], ['猫','ねこ','neko','cat'], ['鳥','とり','tori','bird'],
    ['魚','さかな','sakana','fish'], ['肉','にく','niku','meat'], ['米','こめ','kome','rice'],
    ['お茶','おちゃ','ocha','tea'], ['学校','がっこう','gakkou','school'], ['先生','せんせい','sensei','teacher'],
    ['学生','がくせい','gakusei','student'], ['友達','ともだち','tomodachi','friend'], ['家族','かぞく','kazoku','family'],
    ['電車','でんしゃ','densha','train'], ['車','くるま','kuruma','car'], ['家','いえ','ie','house'],
    ['部屋','へや','heya','room'], ['町','まち','machi','town'], ['国','くに','kuni','country'],
    ['日本','にほん','nihon','Japan'], ['食べ物','たべもの','tabemono','food'], ['飲み物','のみもの','nomimono','drink'],
    ['朝','あさ','asa','morning'], ['夜','よる','yoru','night'], ['今日','きょう','kyou','today'],
    ['明日','あした','ashita','tomorrow'], ['名前','なまえ','namae','name'], ['手','て','te','hand'],
    ['目','め','me','eye'], ['時','とき','toki','time']
  ];
  var VOCAB_N4 = [
    ['会社','かいしゃ','kaisha','company'], ['仕事','しごと','shigoto','job / work'],
    ['病院','びょういん','byouin','hospital'], ['薬','くすり','kusuri','medicine'],
    ['医者','いしゃ','isha','doctor'], ['健康','けんこう','kenkou','health'],
    ['旅行','りょこう','ryokou','travel'], ['切符','きっぷ','kippu','ticket'],
    ['荷物','にもつ','nimotsu','luggage'], ['空港','くうこう','kuukou','airport'],
    ['飛行機','ひこうき','hikouki','airplane'], ['駅','えき','eki','station'],
    ['手紙','てがみ','tegami','letter'], ['新聞','しんぶん','shinbun','newspaper'],
    ['辞書','じしょ','jisho','dictionary'], ['地図','ちず','chizu','map'],
    ['写真','しゃしん','shashin','photograph'], ['映画','えいが','eiga','movie'],
    ['音楽','おんがく','ongaku','music'], ['結婚','けっこん','kekkon','marriage'],
    ['怪我','けが','kega','injury'], ['信号','しんごう','shingou','traffic light'],
    ['交差点','こうさてん','kousaten','intersection'], ['道','みち','michi','road'],
    ['雑誌','ざっし','zasshi','magazine'], ['スポーツ','すぽーつ','supootsu','sports'],
    ['デパート','でぱーと','depaato','department store'], ['経験','けいけん','keiken','experience'],
    ['相談','そうだん','soudan','consultation'], ['準備','じゅんび','junbi','preparation']
  ];

  // N5 READING set — JLPT N5 words written WITHOUT kanji (pure hiragana / katakana),
  // so the learner practises reading the kana letters directly. [kana, romaji, meaning]
  var VOCAB_N5_READ = [
    // --- hiragana words ---
    ['みず','mizu','water'], ['やま','yama','mountain'], ['かわ','kawa','river'],
    ['そら','sora','sky'], ['はな','hana','flower'], ['き','ki','tree'],
    ['ほん','hon','book'], ['ひと','hito','person'], ['いぬ','inu','dog'],
    ['ねこ','neko','cat'], ['とり','tori','bird'], ['さかな','sakana','fish'],
    ['にく','niku','meat'], ['こめ','kome','rice'], ['おちゃ','ocha','tea'],
    ['がっこう','gakkou','school'], ['せんせい','sensei','teacher'], ['がくせい','gakusei','student'],
    ['ともだち','tomodachi','friend'], ['かぞく','kazoku','family'], ['でんしゃ','densha','train'],
    ['くるま','kuruma','car'], ['いえ','ie','house'], ['へや','heya','room'],
    ['まち','machi','town'], ['くに','kuni','country'], ['にほん','nihon','Japan'],
    ['たべもの','tabemono','food'], ['のみもの','nomimono','drink'], ['あさ','asa','morning'],
    ['よる','yoru','night'], ['きょう','kyou','today'], ['あした','ashita','tomorrow'],
    ['なまえ','namae','name'], ['て','te','hand'], ['め','me','eye'],
    ['とき','toki','time'], ['おかね','okane','money'], ['みせ','mise','shop'],
    ['えき','eki','station'],
    // --- katakana (loanword) words ---
    ['テレビ','terebi','television'], ['ラジオ','rajio','radio'], ['カメラ','kamera','camera'],
    ['ホテル','hoteru','hotel'], ['レストラン','resutoran','restaurant'], ['タクシー','takushii','taxi'],
    ['バス','basu','bus'], ['コーヒー','koohii','coffee'], ['ビール','biiru','beer'],
    ['パン','pan','bread'], ['シャツ','shatsu','shirt'], ['コート','kooto','coat'],
    ['ペン','pen','pen'], ['ノート','nooto','notebook'], ['カード','kaado','card'],
    ['テーブル','teeburu','table'], ['ドア','doa','door'], ['エレベーター','erebeetaa','elevator'],
    ['アパート','apaato','apartment'], ['クラス','kurasu','class'], ['テスト','tesuto','test'],
    ['コップ','koppu','cup'], ['ナイフ','naifu','knife'], ['フォーク','fooku','fork'],
    ['スプーン','supuun','spoon'], ['サッカー','sakkaa','soccer'], ['テニス','tenisu','tennis'],
    ['ピアノ','piano','piano'], ['ギター','gitaa','guitar'], ['ゼロ','zero','zero']
  ];

  // Example words keyed by romaji. Missing keys fall back to a graceful "this sound" label.
  var EXAMPLES = {
    a:   ['あめ','ame','rain'], i:['いぬ','inu','dog'], u:['うみ','umi','sea'],
    e:   ['えき','eki','station'], o:['おちゃ','ocha','tea'],
    ka:  ['かさ','kasa','umbrella'], ki:['きた','kita','north'], ku:['くつ','kutsu','shoes'],
    ke:  ['けが','kega','injury'], ko:['こども','kodomo','child'],
    sa:  ['さかな','sakana','fish'], shi:['しま','shima','island'], su:['すし','sushi','sushi'],
    se:  ['せかい','sekai','world'], so:['そら','sora','sky'],
    ta:  ['たまご','tamago','egg'], chi:['ちず','chizu','map'], tsu:['つき','tsuki','moon'],
    te:  ['てがみ','tegami','letter'], to:['とり','tori','bird'],
    na:  ['なつ','natsu','summer'], ni:['にわ','niwa','garden'], nu:['ぬの','nuno','cloth'],
    ne:  ['ねこ','neko','cat'], no:['のり','nori','seaweed'],
    ha:  ['はな','hana','flower'], hi:['ひと','hito','person'], fu:['ふゆ','fuyu','winter'],
    he:  ['へや','heya','room'], ho:['ほし','hoshi','star'],
    ma:  ['まど','mado','window'], mi:['みず','mizu','water'], mu:['むし','mushi','bug'],
    me:  ['めがね','megane','glasses'], mo:['もり','mori','forest'],
    ya:  ['やま','yama','mountain'], yu:['ゆき','yuki','snow'], yo:['よる','yoru','night'],
    ra:  ['らくだ','rakuda','camel'], ri:['りんご','ringo','apple'], ru:['るす','rusu','away from home'],
    re:  ['れきし','rekishi','history'], ro:['ろうそく','rousoku','candle'],
    wa:  ['わたし','watashi','I / me'], wo:['ねこを','neko o','cat (object marker)'],
    n:   ['ほん','hon','book'],
    ga:  ['がっこう','gakkou','school'], gi:['ぎんこう','ginkou','bank'], gu:['ぐち','guchi','complaint'],
    ge:  ['げんき','genki','lively'], go:['ごはん','gohan','rice / meal'],
    za:  ['ざっし','zasshi','magazine'], ji:['じてんしゃ','jitensha','bicycle'], zu:['ずつう','zutsuu','headache'],
    ze:  ['ぜんぶ','zenbu','all'], zo:['ぞう','zou','elephant'],
    da:  ['だいがく','daigaku','university'], di:['はなぢ','hanaji','nosebleed'], du:['つづく','tsuzuku','to continue'],
    de:  ['でんしゃ','densha','train'], do:['どうぶつ','doubutsu','animal'],
    ba:  ['ばんごう','bangou','number'], bi:['びん','bin','bottle'], bu:['ぶた','buta','pig'],
    be:  ['べんとう','bentou','lunch box'], bo:['ぼく','boku','I (masc.)'],
    pa:  ['ぱん','pan','bread'], pi:['ぴか','pika','sparkle'], pu:['ぷーる','puuru','pool'],
    pe:  ['ぺん','pen','pen'], po:['ぽけっと','poketto','pocket'],
    kya: ['きゃく','kyaku','guest'], kyu:['きゅう','kyuu','nine'], kyo:['きょう','kyou','today'],
    sha: ['しゃしん','shashin','photo'], shu:['しゅみ','shumi','hobby'], sho:['しょくじ','shokuji','meal'],
    cha: ['ちゃわん','chawan','tea bowl'], chu:['ちゅうごく','chuugoku','China'], cho:['ちょこ','choko','chocolate'],
    nya: ['にゃんこ','nyanko','kitty'], nyu:['ニュース','nyuusu','news'], nyo:['にょうぼう','nyoubou','wife'],
    hya: ['ひゃく','hyaku','one hundred'], hyu:['ひゅうが','hyuuga','sunny place'], hyo:['ひょう','hyou','leopard'],
    mya: ['みゃく','myaku','pulse'], myu:['ミュージック','myuujikku','music'], myo:['みょうじ','myouji','family name'],
    rya: ['りゃく','ryaku','abbreviation'], ryu:['りゅう','ryuu','dragon'], ryo:['りょうり','ryouri','cooking'],
    gya: ['ぎゃく','gyaku','reverse'], gyu:['ぎゅうにゅう','gyuunyuu','milk'], gyo:['ぎょうざ','gyouza','dumplings'],
    ja:  ['じゃがいも','jagaimo','potato'], ju:['じゅう','juu','ten'], jo:['じょうず','jouzu','skillful'],
    bya: ['びゃく','byaku','white (counter)'], byu:['びゅう','byuu','roar'], byo:['びょうき','byouki','illness'],
    pya: ['ぴゃんこ','pyanko','toddler'], pyu:['ぴゅっと','pyutto','squirt'], pyo:['ぴょんぴょん','pyonpyon','hopping']
  };

  // Romanization variants accepted by the voice fuzzy-matcher.
  var ROMAJI_VARIANTS = {
    shi: ['si'], chi: ['ti'], tsu: ['tu'], fu: ['hu'], wo: ['o'], n: ['nn', 'xn'],
    ji: ['zi', 'di'], zu: ['du', 'dzu'], di: ['ji', 'zi'], du: ['zu', 'dzu'],
    ja: ['jya', 'za'], ju: ['jyu', 'zu'], jo: ['jyo', 'zo'],
    sha: ['sya'], shu: ['syu'], sho: ['syo'],
    cha: ['tya', 'cya'], chu: ['tyu', 'cyu'], cho: ['tyo', 'cyo'],
    kya: ['kya'], o: ['wo']
  };

  function build(rows, group) {
    var out = [];
    rows.forEach(function (r) {
      var romaji = r[0], hira = r[1], kata = r[2];
      var ex = EXAMPLES[romaji];
      var example = ex ? { word: ex[0], romaji: ex[1], meaning: ex[2] }
                       : { word: hira + ' のおと', romaji: romaji + ' no oto', meaning: 'the sound ' + romaji };
      var accepted = [romaji.toLowerCase()];
      (ROMAJI_VARIANTS[romaji] || []).forEach(function (v) { accepted.push(v); });
      out.push({ key: 'hiragana:' + hira, kana: hira, type: 'hiragana', romaji: romaji, group: group, example: example, accepted: accepted });
      out.push({ key: 'katakana:' + kata, kana: kata, type: 'katakana', romaji: romaji, group: group, example: example, accepted: accepted.slice() });
    });
    return out;
  }

  function buildVocab(rows, group) {
    return rows.map(function (r) {
      var word = r[0], hira = r[1], romaji = r[2], meaning = r[3];
      var accepted = [romaji.toLowerCase()];
      (ROMAJI_VARIANTS[romaji] || []).forEach(function (v) { accepted.push(v); });
      return { key: 'vocab:' + group + ':' + word, kana: word, type: 'vocab', romaji: romaji, group: group, hira: hira,
        example: { word: hira, romaji: romaji, meaning: meaning }, accepted: accepted };
    });
  }

  // Reading entries: card shows the kana word itself (no kanji); the reading is the kana.
  function buildReading(rows, group) {
    return rows.map(function (r) {
      var kana = r[0], romaji = r[1], meaning = r[2];
      var accepted = [romaji.toLowerCase()];
      (ROMAJI_VARIANTS[romaji] || []).forEach(function (v) { accepted.push(v); });
      return { key: 'reading:' + group + ':' + kana, kana: kana, type: 'reading', romaji: romaji,
        group: group, hira: toHiragana(kana),
        example: { word: kana, romaji: romaji, meaning: meaning }, accepted: accepted };
    });
  }

  var ALL = build(BASIC, 'basic')
    .concat(build(DAKUTEN, 'dakuten'), build(HANDAKUTEN, 'handakuten'), build(YOON, 'yoon'))
    .concat(buildVocab(VOCAB_N5, 'n5'), buildVocab(VOCAB_N4, 'n4'))
    .concat(buildReading((window.N5READ_WORDS || VOCAB_N5_READ), 'n5read'));

  // Convert katakana → hiragana (for voice-match normalization). Code offset = 0x60.
  function toHiragana(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0x30A1 && c <= 0x30F6) out += String.fromCharCode(c - 0x60);
      else out += s[i];
    }
    return out;
  }

  // Expected hiragana form of an entry (for matching recognized speech in either script).
  function expectedHira(entry) {
    if (entry.hira) return entry.hira; // vocab: reading in hiragana
    if (entry.type === 'hiragana') return entry.kana;
    return toHiragana(entry.kana);
  }

  window.KANA = {
    ALL: ALL,
    byKey: function (k) { for (var i = 0; i < ALL.length; i++) if (ALL[i].key === k) return ALL[i]; return null; },
    toHiragana: toHiragana,
    expectedHira: expectedHira,
    counts: { basic: BASIC.length * 2, dakuten: DAKUTEN.length * 2, handakuten: HANDAKUTEN.length * 2, yoon: YOON.length * 2, n5read: (window.N5READ_WORDS || VOCAB_N5_READ).length }
  };

  // Self-check (C4): hard counts must match.
  // 208 kana + 41 N5 + 30 N4 + N5-reading = 349 (full list replaces the original 70).
  var N5READ_TOTAL = (window.N5READ_WORDS || VOCAB_N5_READ).length;
  console.assert(ALL.length === 279 + N5READ_TOTAL, 'kana+vocab+reading dataset size', ALL.length);
})();
