/* ============================================================
 * vocab-quiz.js — 英语单词随机测试（看单词选汉语）v2
 * 三段式：入口 → 模块选择 → 答题
 * 仅在 front matter 含 vocab-quiz: true 的文章加载
 * ============================================================ */
(function () {
  'use strict';

  var container = document.querySelector('.post-container');
  if (!container) return;

  var QUIZ_PATH = '/vocab-quiz.json';
  var LS_KEY_WRONG = 'vq_wrong_v2';
  var LS_KEY_STATS = 'vq_stats_v2';

  var WORDS = null;
  var UNIT_MAP = {};
  var ALL_MEANINGS = null;

  // 运行时状态
  var currentUnit = null;
  var currentPool = [];
  var queue = [];
  var queueIdx = 0;
  var correctCount = 0;
  var wrongList = [];
  var autoNextTimer = null;

  // ---------- DOM ----------
  var root = document.createElement('div');
  root.className = 'vq-root';
  container.insertBefore(root, container.firstChild);

  root.innerHTML = `
    <div class="vq-page vq-entry" id="vq-entry">
      <h3>📚 四级词汇训练</h3>
      <button type="button" class="vq-btn" id="vq-go-select">🚀 开始训练单词</button>
    </div>

    <div class="vq-page vq-hidden" id="vq-select">
      <div class="vq-page-header">
        <button type="button" class="vq-back-btn" data-go="entry">← 返回</button>
        <h3>选择 Unit</h3>
        <button type="button" class="vq-wrongbook-btn" id="vq-go-wrongbook">
          📖 错题本 <span class="vq-badge" id="vq-wrongbook-count">0</span>
        </button>
      </div>
      <div class="vq-unit-grid" id="vq-unit-grid"></div>
    </div>

    <div class="vq-page vq-hidden" id="vq-quiz">
      <div class="vq-quiz-header">
        <button type="button" class="vq-back-btn" id="vq-quit-quiz">✕ 结束</button>
        <span id="vq-quiz-unit-label">—</span>
        <div class="vq-stats-inline">
          <span class="correct">✓ <b id="vq-correct">0</b></span>
          <span class="wrong">✗ <b id="vq-wrong">0</b></span>
        </div>
      </div>
      <div class="vq-progress-wrap">
        <div class="vq-progress"><div class="vq-progress-bar" id="vq-progress-bar" style="width:0%"></div></div>
        <span class="vq-progress-text" id="vq-progress-text">0/0</span>
      </div>
      <div class="vq-question">
        <div class="vq-word" id="vq-word">—</div>
        <div class="vq-hint" id="vq-hint"></div>
      </div>
      <div class="vq-options" id="vq-options"></div>
      <div class="vq-quiz-footer">
        <div class="vq-feedback info" id="vq-feedback">请选择正确的中文释义</div>
        <button type="button" class="vq-btn secondary vq-hidden" id="vq-next-btn">下一题 →</button>
      </div>
    </div>

    <div class="vq-page vq-hidden" id="vq-result">
      <div class="vq-result">
        <h3 id="vq-result-title">🎉 本轮结束</h3>
        <div class="vq-result-score" id="vq-score">0%</div>
        <div class="vq-result-label" id="vq-result-detail">—</div>
      </div>
      <div id="vq-wrong-detail"></div>
      <div class="vq-actions">
        <button type="button" class="vq-btn" id="vq-restart-btn">🔄 再测一轮</button>
        <button type="button" class="vq-btn secondary" id="vq-back-to-select">← 换个 Unit</button>
      </div>
    </div>

    <div class="vq-page vq-hidden" id="vq-wrongbook">
      <div class="vq-page-header">
        <button type="button" class="vq-back-btn" data-go="select">← 返回</button>
        <h3>📖 错题本</h3>
        <button type="button" class="vq-btn danger small" id="vq-clear-wrong">清空</button>
      </div>
      <div class="vq-wrongbook-summary" id="vq-wrongbook-summary"></div>
      <div class="vq-wrongbook-units" id="vq-wrongbook-units"></div>
    </div>
  `;

  var $ = function (id) { return document.getElementById(id); };

  // ---------- 错题本（localStorage v2，带内存缓存） ----------
  var _wbCache = null;
  function loadWrongBook() {
    if (_wbCache) return _wbCache;
    try {
      var raw = localStorage.getItem(LS_KEY_WRONG);
      _wbCache = raw ? JSON.parse(raw) : {};
    } catch (e) { _wbCache = {}; }
    return _wbCache;
  }
  function saveWrongBook(book) {
    _wbCache = book;
    try { localStorage.setItem(LS_KEY_WRONG, JSON.stringify(book)); } catch (e) {}
  }
  function addToWrongBook(word, meaning, unit) {
    var book = loadWrongBook();
    var k = String(unit);
    if (!book[k]) book[k] = {};
    book[k][word] = { meaning: meaning };
    saveWrongBook(book);
  }
  function removeFromWrongBook(word, unit) {
    var book = loadWrongBook();
    var k = String(unit);
    if (book[k] && book[k][word]) {
      delete book[k][word];
      if (Object.keys(book[k]).length === 0) delete book[k];
      saveWrongBook(book);
    }
  }
  function clearWrongBook() { saveWrongBook({}); }

  // ---------- 累计统计（永久保留，带内存缓存） ----------
  var _statsCache = null;
  function loadStats() {
    if (_statsCache) return _statsCache;
    try {
      var raw = localStorage.getItem(LS_KEY_STATS);
      _statsCache = raw ? JSON.parse(raw) : null;
    } catch (e) { _statsCache = null; }
    if (!_statsCache) {
      // 首次迁移：把旧错题本里的累计错次并入统计
      _statsCache = {};
      var book = loadWrongBook();
      Object.keys(book).forEach(function (u) {
        Object.keys(book[u]).forEach(function (w) {
          var c = book[u][w].count;
          if (c > 0) _statsCache[w] = { r: 0, w: c };
        });
      });
      saveStats(_statsCache);
    }
    return _statsCache;
  }
  function saveStats(s) {
    _statsCache = s;
    try { localStorage.setItem(LS_KEY_STATS, JSON.stringify(s)); } catch (e) {}
  }
  function recordResult(word, isCorrect) {
    var s = loadStats();
    if (!s[word]) s[word] = { r: 0, w: 0 };
    if (isCorrect) s[word].r += 1; else s[word].w += 1;
    saveStats(s);
  }

  function wrongBookTotalWords() {
    var book = loadWrongBook();
    var set = {};
    Object.keys(book).forEach(function (u) {
      Object.keys(book[u]).forEach(function (w) { set[w] = true; });
    });
    return Object.keys(set).length;
  }
  function wrongCountOfUnit(unit) {
    var book = loadWrongBook();
    var k = String(unit);
    if (!book[k]) return 0;
    return Object.keys(book[k]).length;
  }
  function wrongTimesOfUnit(unit) {
    var book = loadWrongBook();
    var k = String(unit);
    if (!book[k]) return 0;
    var stats = loadStats();
    var sum = 0;
    Object.keys(book[k]).forEach(function (w) {
      if (stats[w]) sum += stats[w].w;
    });
    return sum;
  }

  // ---------- 数据加载 ----------
  function loadWords() {
    return fetch(QUIZ_PATH, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        WORDS = data;
        UNIT_MAP = {};
        data.forEach(function (w) {
          if (!UNIT_MAP[w.unit]) UNIT_MAP[w.unit] = [];
          UNIT_MAP[w.unit].push(w);
        });
        var ms = {};
        data.forEach(function (w) { ms[w.meaning] = true; });
        ALL_MEANINGS = Object.keys(ms);
      })
      .catch(function (err) {
        console.error('[vocab-quiz] 题库加载失败：', err);
        var btn = $('vq-go-select');
        btn.disabled = true;
        btn.textContent = '题库加载失败';
      });
  }

  // ---------- 工具 ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pickDistractors(correctMeaning, n) {
    var pool = ALL_MEANINGS.filter(function (m) { return m !== correctMeaning; });
    if (pool.length < n) {
      pool = WORDS.filter(function (w) { return w.meaning !== correctMeaning; })
                  .map(function (w) { return w.meaning; });
      pool = shuffle(pool);
    }
    return shuffle(pool).slice(0, n);
  }

  // ---------- 页面切换 ----------
  function go(page) {
    ['entry', 'select', 'quiz', 'result', 'wrongbook'].forEach(function (id) {
      var el = $('vq-' + id);
      if (!el) return;
      if (id === page) {
        el.classList.remove('vq-hidden');
        // 重排后再加 class，保证重复进入同一页时动画重新播放
        el.classList.remove('vq-enter');
        void el.offsetWidth;
        el.classList.add('vq-enter');
      } else {
        el.classList.add('vq-hidden');
        el.classList.remove('vq-enter');
      }
    });
  }

  // ---------- 模块选择 ----------
  function renderUnitGrid() {
    var grid = $('vq-unit-grid');
    var html = '';
    for (var u = 1; u <= 10; u++) {
      var words = UNIT_MAP[u] || [];
      var wc = wrongCountOfUnit(u);
      var wt = wrongTimesOfUnit(u);
      var badgeHtml = '';
      if (wc > 0) {
        badgeHtml = '<span class="vq-unit-wrong-badge" title="错题 ' + wc + ' 词，累计 ' + wt + ' 次">' +
                    wc + ' 词错题</span>';
      }
      html += '<button type="button" class="vq-unit-card" data-unit="' + u + '">' +
        '<div class="vq-unit-num">Unit ' + u + '</div>' +
        '<div class="vq-unit-count">' + words.length + ' 词</div>' +
        badgeHtml +
      '</button>';
    }
    grid.innerHTML = html;
    $('vq-wrongbook-count').textContent = wrongBookTotalWords();
  }

  // ---------- 答题 ----------
  function startQuiz(unit) {
    currentUnit = unit;
    currentPool = UNIT_MAP[unit] || [];
    queue = shuffle(currentPool);
    queueIdx = 0;
    correctCount = 0;
    wrongList = [];

    $('vq-quiz-unit-label').textContent = 'Unit ' + unit + '（' + currentPool.length + ' 词）';
    go('quiz');
    renderQuestion();
  }

  function renderQuestion() {
    if (queueIdx >= queue.length) { showResult(); return; }
    if (autoNextTimer) { clearTimeout(autoNextTimer); autoNextTimer = null; }

    var item = queue[queueIdx];
    $('vq-progress-bar').style.width = Math.round((queueIdx / queue.length) * 100) + '%';
    $('vq-progress-text').textContent = (queueIdx + 1) + '/' + queue.length;
    $('vq-correct').textContent = correctCount;
    $('vq-wrong').textContent = wrongList.length;

    $('vq-word').textContent = item.word;
    $('vq-hint').textContent = item.mnemonic ? '💡 ' + item.mnemonic : '';
    $('vq-feedback').className = 'vq-feedback info';
    $('vq-feedback').textContent = '请选择正确的中文释义';
    $('vq-next-btn').classList.add('vq-hidden');

    var distractors = pickDistractors(item.meaning, 3);
    var options = shuffle([item.meaning].concat(distractors));
    var letters = ['A', 'B', 'C', 'D'];

    var html = '';
    options.forEach(function (opt, i) {
      var isCorrect = opt === item.meaning;
      html += '<button type="button" class="vq-option" data-correct="' + (isCorrect ? '1' : '0') + '">' +
        '<span class="vq-letter">' + letters[i] + '</span>' + esc(opt) + '</button>';
    });
    $('vq-options').innerHTML = html;
  }

  function onOptionClick(e) {
    var btn = e.target.closest('.vq-option');
    if (!btn || btn.disabled) return;

    var allOpts = $('vq-options').querySelectorAll('.vq-option');
    allOpts.forEach(function (o) { o.disabled = true; });

    var correct = btn.getAttribute('data-correct') === '1';
    var item = queue[queueIdx];

    if (correct) {
      correctCount++;
      btn.classList.add('selected-correct');
      $('vq-feedback').className = 'vq-feedback ok';
      $('vq-feedback').textContent = '✓ 回答正确！';
      removeFromWrongBook(item.word, currentUnit);
      recordResult(item.word, true);
      autoNextTimer = setTimeout(nextQuestion, 1200);
    } else {
      btn.classList.add('selected-wrong');
      $('vq-feedback').className = 'vq-feedback no';
      $('vq-feedback').textContent = '✗ 正确答案：' + item.meaning;
      allOpts.forEach(function (o) {
        if (o.getAttribute('data-correct') === '1') o.classList.add('show-correct');
      });
      addToWrongBook(item.word, item.meaning, currentUnit);
      recordResult(item.word, false);
      wrongList.push({ word: item.word, meaning: item.meaning, unit: currentUnit });
      $('vq-next-btn').classList.remove('vq-hidden');
    }
    $('vq-correct').textContent = correctCount;
    $('vq-wrong').textContent = wrongList.length;
  }

  function nextQuestion() { queueIdx++; renderQuestion(); }

  function showResult() {
    if (autoNextTimer) { clearTimeout(autoNextTimer); autoNextTimer = null; }
    go('result');
    var rate = currentPool.length === 0 ? 0 :
      Math.round((correctCount / currentPool.length) * 100);
    $('vq-score').textContent = rate + '%';
    $('vq-result-detail').textContent =
      'Unit ' + currentUnit + '：正确 ' + correctCount + ' / ' + currentPool.length +
      (wrongList.length > 0 ? ' · 错误 ' + wrongList.length : ' · 全部答对 🎉');
    $('vq-restart-btn').dataset.unit = currentUnit;

    var detail = $('vq-wrong-detail');
    if (wrongList.length > 0) {
      var html = '<div class="vq-wrong-list">';
      wrongList.forEach(function (w) {
        html += '<div class="vq-wrong-item">' +
          '<span class="w">' + esc(w.word) + '</span>' +
          '<span class="m">' + esc(w.meaning) + '</span>' +
          '</div>';
      });
      html += '</div>';
      detail.innerHTML = html;
    } else {
      detail.innerHTML = '<p style="color:var(--vq-success);font-size:14px;text-align:center;">🎉 全对！</p>';
    }
  }

  // ---------- 错题本 ----------
  function renderWrongBook() {
    $('vq-wrongbook-count').textContent = wrongBookTotalWords();
    var book = loadWrongBook();
    var stats = loadStats();

    var totalUnits = Object.keys(book).filter(function (k) { return Object.keys(book[k]).length > 0; }).length;
    var totalWords = wrongBookTotalWords();
    var totalTimes = 0;
    Object.keys(book).forEach(function (u) {
      Object.keys(book[u]).forEach(function (w) {
        if (stats[w]) totalTimes += stats[w].w;
      });
    });
    $('vq-wrongbook-summary').innerHTML =
      '<span>📚 <b>' + totalUnits + '</b> 个 Unit 有错题</span>' +
      '<span>📖 共 <b>' + totalWords + '</b> 个不同单词</span>' +
      '<span>🔁 累计错 <b>' + totalTimes + '</b> 次</span>';

    var html = '';
    var hasAny = false;
    for (var u = 1; u <= 10; u++) {
      var k = String(u);
      if (!book[k] || Object.keys(book[k]).length === 0) continue;
      hasAny = true;
      var words = Object.keys(book[k]);
      var wt = 0;
      words.forEach(function (w) { if (stats[w]) wt += stats[w].w; });

      html += '<div class="vq-wb-unit-block">' +
        '<div class="vq-wb-unit-header">' +
          '<span class="vq-wb-unit-name">Unit ' + u + '</span>' +
          '<span class="vq-wb-unit-meta">' + words.length + ' 词 · 累计错 ' + wt + ' 次</span>' +
          '<button type="button" class="vq-btn secondary small" data-practice-unit="' + u + '">🎯 练这个</button>' +
        '</div>' +
        '<div class="vq-wb-word-list">';
      words.forEach(function (w) {
        var times = stats[w] ? stats[w].w : 0;
        html += '<div class="vq-wb-word-item">' +
          '<span class="w">' + esc(w) + '</span>' +
          '<span class="count">×' + times + '</span>' +
          '<span class="m">' + esc(book[k][w].meaning) + '</span>' +
          '<button type="button" class="vq-remove-wrong" data-unit="' + u + '" data-word="' + esc(w) + '" title="从错题本移除">✕</button>' +
        '</div>';
      });
      html += '</div></div>';
    }
    if (!hasAny) {
      html = '<div style="text-align:center;color:var(--vq-muted);padding:40px 0;">📭 错题本是空的</div>';
    }
    $('vq-wrongbook-units').innerHTML = html;
  }

  // ---------- 事件代理 ----------
  root.addEventListener('click', function (e) {
    var t = e.target;

    // 返回按钮
    var backBtn = t.closest('[data-go]');
    if (backBtn) { go(backBtn.getAttribute('data-go')); return; }

    // 模块卡片
    var unitCard = t.closest('.vq-unit-card');
    if (unitCard) {
      startQuiz(parseInt(unitCard.getAttribute('data-unit'), 10));
      return;
    }

    // 选项
    var opt = t.closest('.vq-option');
    if (opt && !opt.disabled) { onOptionClick(e); return; }

    // 错题本内：练某个 Unit
    var practiceBtn = t.closest('[data-practice-unit]');
    if (practiceBtn) {
      startQuiz(parseInt(practiceBtn.getAttribute('data-practice-unit'), 10));
      return;
    }
    // 错题本内：移除某个
    var rmBtn = t.closest('.vq-remove-wrong');
    if (rmBtn) {
      removeFromWrongBook(rmBtn.getAttribute('data-word'), parseInt(rmBtn.getAttribute('data-unit'), 10));
      renderWrongBook();
      renderUnitGrid();
      return;
    }

    var id = t.id;
    if (id === 'vq-go-select') { renderUnitGrid(); go('select'); }
    else if (id === 'vq-go-wrongbook') { renderWrongBook(); go('wrongbook'); }
    else if (id === 'vq-quit-quiz') { if (confirm('确定结束本轮测试？')) showResult(); }
    else if (id === 'vq-next-btn') nextQuestion();
    else if (id === 'vq-restart-btn') startQuiz(parseInt(t.dataset.unit, 10));
    else if (id === 'vq-back-to-select') { renderUnitGrid(); go('select'); }
    else if (id === 'vq-clear-wrong') {
      if (confirm('确定清空所有错题记录？')) {
        clearWrongBook();
        renderWrongBook();
        renderUnitGrid();
      }
    }
  });

  // ---------- 启动 ----------
  loadWords();
})();
