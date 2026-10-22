/* Editor shell: panes, autosave, and file actions. No network calls. */
(function () {
  'use strict';

  var TEXT_KEY = 'simple-agentic-md:text';
  var NAME_KEY = 'simple-agentic-md:name';
  var SAMPLE_IMAGE =
    'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27180%27 height=%2748%27%3E%3Crect width=%27180%27 height=%2748%27 rx=%278%27 fill=%27%23e0a45c%27/%3E%3Ctext x=%2716%27 y=%2731%27 fill=%27%231a1208%27 font-family=%27Georgia%27 font-size=%2718%27%3Eimage%3C/text%3E%3C/svg%3E';

  var SAMPLE = [
    '# simple-agentic-md',
    '',
    'A local Markdown editor with a live preview. This note uses **bold**, *italic*, `inline code`, and a [link](https://example.com).',
    '',
    '## Headings',
    '',
    '### Level three',
    '',
    '#### Level four',
    '',
    '##### Level five',
    '',
    '###### Level six',
    '',
    '## Lists',
    '',
    'Unordered, with one nested level:',
    '',
    '- Apples',
    '- Citrus',
    '  - Blood orange',
    '  - Clementine',
    '- Pears',
    '',
    'Ordered, with one nested level:',
    '',
    '1. Write the source',
    '2. Check the preview',
    '   1. Headings and lists',
    '   2. Tables and code',
    '3. Download the file',
    '',
    'An ordered list nested under an unordered item:',
    '',
    '- Parent item',
    '  1. First child',
    '  2. Second child',
    '',
    '## Table',
    '',
    '| Mark | Preview | Align |',
    '| --- | :---: | ---: |',
    '| **bold** | strong | default |',
    '| *italic* | emphasis | centered |',
    '| `code` | code | right |',
    '',
    '## Blockquote',
    '',
    '> Raw HTML stays text, so a typed script tag never runs.',
    '> **Bold** and *italic* still work inside a quote.',
    '',
    '## Horizontal rule',
    '',
    '---',
    '',
    '## Image',
    '',
    '![Amber swatch labeled image](' + SAMPLE_IMAGE + ')',
    '',
    '## Fenced code',
    '',
    '```js',
    'function greet(name) {',
    '  return "Hello, " + name;',
    '}',
    '```',
    '',
    '## Literal text',
    '',
    '<script>alert(1)</script>',
    '',
    'A javascript URL is not a link: [x](javascript:alert(1)).',
    ''
  ].join('\n');

  var editor = document.getElementById('editor');
  var preview = document.getElementById('preview');
  var notice = document.getElementById('notice');
  var noticeText = document.getElementById('notice-text');
  var fileInput = document.getElementById('file-input');
  var saveState = document.getElementById('save-state');
  var docName = document.getElementById('doc-name');
  var charCount = document.getElementById('char-count');

  var filename = 'untitled.md';
  var storageOk = true;
  var saveTimer = 0;
  var renderFrame = 0;

  function showNotice(message) {
    noticeText.textContent = message;
    notice.hidden = false;
  }

  function setStatus(text) {
    saveState.textContent = text;
  }

  function safeName(name) {
    var base = String(name || '').replace(/^.*[\\/]/, '');
    base = base.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\\/:*?"<>|]/g, '');
    base = base.replace(/\.(md|markdown|txt)$/i, '').trim().replace(/^\.+/, '');
    if (!base) base = 'untitled';
    if (base.length > 100) base = base.slice(0, 100).trim() || 'untitled';
    return base + '.md';
  }

  function updateName() {
    docName.textContent = filename;
  }

  function updateCount() {
    var count = editor.value.length;
    charCount.textContent = count === 1 ? '1 character' : count + ' characters';
  }

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      storageOk = false;
      return null;
    }
  }

  function persistNow() {
    if (!storageOk) {
      setStatus('Not saved');
      return;
    }
    try {
      localStorage.setItem(TEXT_KEY, editor.value);
      localStorage.setItem(NAME_KEY, filename);
      setStatus('Saved');
    } catch (err) {
      storageOk = false;
      setStatus('Not saved');
      showNotice(
        'Could not save this document. Storage is unavailable or full, so a reload will not restore this text. You can still edit and download it.'
      );
    }
  }

  function scheduleSave() {
    if (!storageOk) {
      setStatus('Not saved');
      return;
    }
    setStatus('Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistNow, 250);
  }

  function badUrl(value, kind) {
    var probe = String(value || '').replace(/[\u0000-\u0020]+/g, '');
    if (/^(javascript|vbscript):/i.test(probe)) return true;
    if (kind === 'link' && /^data:/i.test(probe)) return true;
    return false;
  }

  function harden(root) {
    root.querySelectorAll('script, iframe, object, embed, base, link, meta, form').forEach(function (el) {
      el.remove();
    });
    root.querySelectorAll('*').forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        if (name.indexOf('on') === 0) {
          el.removeAttribute(attr.name);
          return;
        }
        if ((name === 'href' || name === 'xlink:href') && badUrl(attr.value, 'link')) {
          el.removeAttribute(attr.name);
        } else if (name === 'src' && badUrl(attr.value, 'image')) {
          el.removeAttribute(attr.name);
        }
      });
    });
  }

  function renderNow() {
    updateCount();
    if (!editor.value.trim()) {
      preview.innerHTML = '<p class="placeholder">Nothing to preview yet.</p>';
      return;
    }
    try {
      preview.innerHTML = window.SimpleMarkdown.render(editor.value);
      harden(preview);
    } catch (err) {
      preview.textContent = 'The preview could not be rendered.';
    }
  }

  function scheduleRender() {
    cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(renderNow);
  }

  function loadInitial() {
    var stored = storageGet(TEXT_KEY);
    if (!storageOk) {
      editor.value = SAMPLE;
      filename = 'untitled.md';
      updateName();
      setStatus('Not saved');
      showNotice(
        'This browser is not keeping a local copy (storage is unavailable). You can still edit, open, and download. A reload will not restore your text.'
      );
      return;
    }
    if (stored === null) {
      editor.value = SAMPLE;
      filename = 'untitled.md';
      updateName();
      persistNow();
      return;
    }
    editor.value = stored;
    filename = safeName(storageGet(NAME_KEY) || 'untitled.md');
    updateName();
    setStatus('Saved');
  }

  function confirmDiscard(action) {
    if (editor.value.length === 0) return true;
    return window.confirm(action + ' The current text will be discarded.');
  }

  function newDocument() {
    if (!confirmDiscard('Start a new document?')) return;
    filename = 'untitled.md';
    editor.value = '';
    updateName();
    renderNow();
    persistNow();
    editor.focus();
  }

  function openSelected(file) {
    if (!file) return;
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      showNotice('Choose a .md, .markdown, or .txt file.');
      return;
    }
    if (!confirmDiscard('Open this file?')) return;
    var reader = new FileReader();
    reader.onload = function () {
      filename = safeName(file.name);
      editor.value = typeof reader.result === 'string' ? reader.result : '';
      updateName();
      renderNow();
      persistNow();
      editor.focus();
    };
    reader.onerror = function () {
      showNotice('Could not read that file. The editor is unchanged.');
    };
    reader.readAsText(file);
  }

  function download() {
    var blob = new Blob([editor.value], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename || 'untitled.md';
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1500);
    }
  }

  function onPreviewClick(event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var anchor = target.closest('a');
    if (!anchor || !preview.contains(anchor)) return;
    var href = anchor.getAttribute('href') || '';
    if (!/^(https?:|mailto:)/i.test(href)) event.preventDefault();
  }

  function insertAtCaret(text) {
    var start = editor.selectionStart;
    var end = editor.selectionEnd;
    var value = editor.value;
    editor.value = value.slice(0, start) + text + value.slice(end);
    editor.selectionStart = editor.selectionEnd = start + text.length;
  }

  function outdentAtCaret() {
    var start = editor.selectionStart;
    var value = editor.value;
    var lineStart = value.lastIndexOf('\n', start - 1) + 1;
    var prefix = value.slice(lineStart, start);
    var remove = prefix.endsWith('  ') ? 2 : prefix.endsWith(' ') ? 1 : prefix.endsWith('\t') ? 1 : 0;
    if (!remove) return;
    editor.value = value.slice(0, start - remove) + value.slice(start);
    editor.selectionStart = editor.selectionEnd = start - remove;
  }

  document.getElementById('btn-new').addEventListener('click', newDocument);
  document.getElementById('btn-open').addEventListener('click', function () {
    fileInput.click();
  });
  document.getElementById('btn-download').addEventListener('click', download);
  document.getElementById('notice-dismiss').addEventListener('click', function () {
    notice.hidden = true;
  });

  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (file) openSelected(file);
  });

  editor.addEventListener('input', function () {
    scheduleRender();
    scheduleSave();
  });

  editor.addEventListener('keydown', function (event) {
    if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    if (event.shiftKey) outdentAtCaret();
    else insertAtCaret('  ');
    scheduleRender();
    scheduleSave();
  });

  document.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      download();
    }
  });

  preview.addEventListener('click', onPreviewClick);
  preview.addEventListener('auxclick', onPreviewClick);

  loadInitial();
  renderNow();
})();
