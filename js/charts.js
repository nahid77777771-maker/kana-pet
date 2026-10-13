/* KanaPet — All Kana Charts Display */
(function() {
  'use strict';
  
  function createChart() {
    var chartData = [];
    // Basic
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
    
    BASIC.forEach(function(r){ chartData.push({romaji:r[0], hira:r[1], kata:r[2], type:'basic', script:'both'}); });
    DAKUTEN.forEach(function(r){ chartData.push({romaji:r[0], hira:r[1], kata:r[2], type:'dakuten', script:'both'}); });
    HANDAKUTEN.forEach(function(r){ chartData.push({romaji:r[0], hira:r[1], kata:r[2], type:'handakuten', script:'both'}); });
    YOON.forEach(function(r){ chartData.push({romaji:r[0], hira:r[1], kata:r[2], type:'yoon', script:'both'}); });
    
    return chartData;
  }
  
  var allKana = createChart();
  
  function renderCharts(filter) {
    var container = document.getElementById('charts-container');
    if (!container) return;
    var filtered = allKana;
    if (filter) {
      filtered = allKana.filter(function(item) {
        if (filter.search) {
          var s = filter.search.toLowerCase();
          if (item.romaji.indexOf(s) === -1 && item.hira.indexOf(s) === -1 && item.kata.indexOf(s) === -1) return false;
        }
        if (filter.chart === 'hira') return true; // show all hira items? but each has both - easier to show based on type/script group
        if (filter.chart === 'kata') return true;
        if (filter.chart === 'basic' && item.type === 'basic') return true;
        if (filter.chart === 'dakuten' && item.type === 'dakuten') return true;
        if (filter.chart === 'handakuten' && item.type === 'handakuten') return true;
        if (filter.chart === 'yoon' && item.type === 'yoon') return true;
        if (filter.chart === 'all') return true;
        return false;
      });
    }
    // Better filtering logic
    filtered = allKana;
    if (filter) {
      filtered = allKana.filter(function(item) {
        var matchesSearch = true;
        if (filter.search) {
          var s = filter.search.toLowerCase();
          matchesSearch = (item.romaji.indexOf(s) !== -1 || item.hira.indexOf(s) !== -1 || item.kata.indexOf(s) !== -1);
        }
        if (!matchesSearch) return false;
        if (filter.chart === 'all') return true;
        if (filter.chart === 'basic') return item.type === 'basic';
        if (filter.chart === 'dakuten') return item.type === 'dakuten';
        if (filter.chart === 'handakuten') return item.type === 'handakuten';
        if (filter.chart === 'yoon') return item.type === 'yoon';
        return true;
      });
    }
    
    // Group by type
    var groups = {};
    filtered.forEach(function(item) {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });
    
    var html = '';
    var typeOrder = ['basic', 'dakuten', 'handakuten', 'yoon'];
    var typeLabels = {
      basic: (window.I18n ? window.I18n.t('monographs') : 'Monographs'),
      dakuten: (window.I18n ? window.I18n.t('tenTen') : 'Ten-ten'),
      handakuten: (window.I18n ? window.I18n.t('handakuten') : 'Handakuten'),
      yoon: (window.I18n ? window.I18n.t('yoonSet') : 'Yōon')
    };
    
    typeOrder.forEach(function(t) {
      if (groups[t] && groups[t].length > 0) {
        html += '<div class="chart-section">';
        html += '<h4 style="margin:15px 0 8px;padding:8px 12px;background:var(--accent-soft);border-radius:12px">' + typeLabels[t] + '</h4>';
        html += '<div class="chart-grid">';
        groups[t].forEach(function(item) {
          html += '<div class="chart-cell">';
          html += '<div class="chart-romaji">' + item.romaji + '</div>';
          html += '<div class="chart-kana jp kana-sound" data-speak="' + item.hira + '" role="button" tabindex="0" aria-label="Hear ' + item.romaji + '">' + item.hira + '</div>';
          html += '<div class="chart-kana jp kana-sound" data-speak="' + item.kata + '" role="button" tabindex="0" aria-label="Hear ' + item.romaji + '">' + item.kata + '</div>';
          html += '</div>';
        });
        html += '</div></div>';
      }
    });
    if (html === '') html = '<div style="text-align:center;padding:40px;color:var(--muted)">No results</div>';
    container.innerHTML = html;
  }
  
  window.Charts = {
    render: renderCharts,
    all: allKana
  };
})();
