/* ============================================================
 * word-reader.js — 英语单词点击朗读（Web Speech API）
 * 仅在 front matter 含 word-reader: true 的文章加载
 * 开启后才会改动正文 DOM，关闭时完整还原
 * ============================================================ */
(function () {
  'use strict';

  var container = document.querySelector('.post-container');
  if (!container) return;
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;

  var synth = window.speechSynthesis;
  var ACTIVE_CLASS = 'word-reader-on';

  /* 遍历时跳过的区域：代码块 / Mermaid / MathJax / 评论 / 按钮栏 / 已包裹节点 */
  var SKIP_SELECTOR = [
    'pre', 'code', 'kbd', 'samp',
    '.highlight', '.rouge-gutter', '.rouge-code',
    '.mermaid', '.mermaid-card', '.mermaid-wrapper',
    '.MathJax', '.MathJax_Preview', 'math', '.mjx-container',
    '#comment-section', '.comment', '.giscus',
    '.wr-toggle-bar', '.anchorjs-link',
    'script', 'style', 'noscript',
    '.wr-word'
  ].join(',');

  /* 英文单词：支持连字符（long-term）和撇号（don't / it's） */
  var WORD_RE = /[A-Za-z][A-Za-z'’]*(?:-[A-Za-z][A-Za-z'’]*)*/g;
  var HAS_LETTER_RE = /[A-Za-z]/;

  /* ---------- 开关按钮栏 ---------- */
  var bar = document.createElement('div');
  bar.className = 'wr-toggle-bar';
  bar.innerHTML =
    '<button type="button" class="wr-toggle-btn" aria-pressed="false">🔊 开启单词朗读</button>' +
    '<span class="wr-tip">开启后，点击文章里任意英文单词即可朗读</span>';
  container.insertBefore(bar, container.firstChild);

  var btn = bar.querySelector('.wr-toggle-btn');

  /* ---------- 语音选择（优先 en-US，其次任意 en） ---------- */
  var voices = [];
  function loadVoices() {
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
  }
  loadVoices();
  if (synth.addEventListener) {
    synth.addEventListener('voiceschanged', loadVoices);
  } else {
    synth.onvoiceschanged = loadVoices;
  }

  function pickVoice() {
    if (!voices.length) loadVoices();
    for (var i = 0; i < voices.length; i++) {
      if (/^en-US/i.test(voices[i].lang)) return voices[i];
    }
    for (var j = 0; j < voices.length; j++) {
      if (/^en/i.test(voices[j].lang)) return voices[j];
    }
    return null;
  }

  function speak(word, el) {
    /* 快速连点时先清空队列，避免语音重叠排队 */
    synth.cancel();

    var u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    u.rate = 0.9;
    u.pitch = 1;
    var voice = pickVoice();
    if (voice) u.voice = voice;

    var prev = container.querySelector('.wr-word.speaking');
    if (prev) prev.classList.remove('speaking');
    if (el) {
      el.classList.add('speaking');
      u.onend = u.onerror = function () { el.classList.remove('speaking'); };
    }
    synth.speak(u);
  }

  /* 事件委托：点击单词朗读，并阻止冒泡（防止触发链接跳转等） */
  container.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.nodeType === 1 && t.classList && t.classList.contains('wr-word')) {
      e.preventDefault();
      e.stopPropagation();
      speak(t.textContent, t);
    }
  });

  /* ---------- 把文本节点中的英文单词包成 span ---------- */
  function wrapTextNode(textNode) {
    var text = textNode.nodeValue;
    if (!HAS_LETTER_RE.test(text)) return;

    var frag = document.createDocumentFragment();
    var last = 0;
    var m;
    WORD_RE.lastIndex = 0;

    while ((m = WORD_RE.exec(text)) !== null) {
      if (m.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      }
      var span = document.createElement('span');
      span.className = 'wr-word';
      span.textContent = m[0];
      frag.appendChild(span);
      last = m.index + m[0].length;
    }
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)));
    }
    textNode.parentNode.replaceChild(frag, textNode);
  }

  function enable() {
    if (container.classList.contains(ACTIVE_CLASS)) return;

    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentElement;
        if (!p || p.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
        if (!HAS_LETTER_RE.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    /* 先收集再替换，避免 TreeWalker 遍历过程中改动 DOM */
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(wrapTextNode);

    container.classList.add(ACTIVE_CLASS);
    bar.classList.add('active');
    btn.textContent = '🔇 关闭单词朗读';
    btn.setAttribute('aria-pressed', 'true');
  }

  function disable() {
    if (!container.classList.contains(ACTIVE_CLASS)) return;

    synth.cancel();

    /* 用纯文本节点替换所有包裹 span，再 normalize 合并相邻文本 */
    var spans = container.querySelectorAll('.wr-word');
    Array.prototype.forEach.call(spans, function (span) {
      span.parentNode.replaceChild(document.createTextNode(span.textContent), span);
    });
    container.normalize();

    container.classList.remove(ACTIVE_CLASS);
    bar.classList.remove('active');
    btn.textContent = '🔊 开启单词朗读';
    btn.setAttribute('aria-pressed', 'false');
  }

  btn.addEventListener('click', function () {
    if (container.classList.contains(ACTIVE_CLASS)) {
      disable();
    } else {
      enable();
    }
  });

  /* 离开页面时停止朗读 */
  window.addEventListener('pagehide', function () {
    synth.cancel();
  });
})();
