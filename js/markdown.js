/* Hand-written Markdown subset for simple-agentic-md.
 *
 * Loaded as a classic script (window.SimpleMarkdown) so the editor works
 * from file://, where type=module is blocked in some browsers. Node tests
 * load the same file through module.exports.
 *
 * Raw HTML is escaped. javascript: and vbscript: URLs are not emitted for
 * links or images. data: URLs are not emitted for links.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }
  if (root) root.SimpleMarkdown = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ESCAPABLE = /[\\`*_{}\[\]()#+\-.!|&<>]/;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function decodeEntities(value) {
    return String(value).replace(
      /&(#x[0-9a-f]+|#\d+|colon|tab|newline|amp);?/gi,
      function (all, body) {
        var name = body.toLowerCase();
        if (name === 'colon') return ':';
        if (name === 'tab') return '\t';
        if (name === 'newline') return '\n';
        if (name === 'amp') return '&';
        if (name.charAt(0) === '#') {
          var hex = name.charAt(1) === 'x';
          var codePoint = parseInt(hex ? name.slice(2) : name.slice(1), hex ? 16 : 10);
          if (!isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return all;
          try {
            return String.fromCodePoint(codePoint);
          } catch (err) {
            return all;
          }
        }
        return all;
      }
    );
  }

  function percentDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch (err) {
      return value.replace(/%([0-9a-f]{2})/gi, function (all, hex) {
        var code = parseInt(hex, 16);
        return code <= 0xff ? String.fromCharCode(code) : all;
      });
    }
  }

  function schemeProbe(url) {
    var current = String(url);
    for (var pass = 0; pass < 4; pass++) {
      var next = percentDecode(decodeEntities(current));
      next = next.replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\ufeff]/g, '');
      if (next === current) break;
      current = next;
    }
    return current;
  }

  function isBlockedUrl(url, kind) {
    var probe = schemeProbe(url);
    if (/^(javascript|vbscript):/i.test(probe)) return true;
    if (kind !== 'image' && /^data:/i.test(probe)) return true;
    return false;
  }

  function stripControls(url) {
    return String(url).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  }

  function renderAnchor(labelHtml, url, title) {
    var cleaned = stripControls(url);
    if (!cleaned || isBlockedUrl(cleaned, 'link')) {
      return '<span class="blocked-link">' + labelHtml + '</span>';
    }
    var html = '<a href="' + escapeHtml(cleaned) + '"';
    if (title) html += ' title="' + escapeHtml(title) + '"';
    if (/^(https?:|mailto:)/i.test(cleaned)) {
      html += ' target="_blank" rel="noopener noreferrer"';
    }
    return html + '>' + labelHtml + '</a>';
  }

  function renderImage(alt, url, title) {
    var cleaned = stripControls(url);
    var safeAlt = escapeHtml(alt);
    if (!cleaned || isBlockedUrl(cleaned, 'image')) {
      return '<span class="blocked-image">' + safeAlt + '</span>';
    }
    var html = '<img src="' + escapeHtml(cleaned) + '" alt="' + safeAlt + '"';
    if (title) html += ' title="' + escapeHtml(title) + '"';
    return html + '>';
  }

  function findClosing(source, openIndex, openChar, closeChar) {
    var depth = 1;
    for (var i = openIndex + 1; i < source.length; i++) {
      var ch = source.charAt(i);
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === '\n') return -1;
      if (ch === openChar) depth++;
      else if (ch === closeChar) {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function parseDestination(raw) {
    var text = String(raw).trim();
    var title = '';
    var titled = /\s+"([^"]*)"\s*$/.exec(text) || /\s+'([^']*)'\s*$/.exec(text);
    if (titled) {
      title = titled[1];
      text = text.slice(0, titled.index).trim();
    }
    if (text.charAt(0) === '<' && text.charAt(text.length - 1) === '>' && text.length >= 2) {
      text = text.slice(1, -1);
    }
    return { url: text, title: title };
  }

  function matchLink(source, index) {
    if (source.charAt(index) !== '[') return null;
    var labelEnd = findClosing(source, index, '[', ']');
    if (labelEnd < 0 || source.charAt(labelEnd + 1) !== '(') return null;
    var destEnd = findClosing(source, labelEnd + 1, '(', ')');
    if (destEnd < 0) return null;
    var dest = parseDestination(source.slice(labelEnd + 2, destEnd));
    if (/[\r\n]/.test(dest.url)) return null;
    return {
      label: source.slice(index + 1, labelEnd),
      url: dest.url,
      title: dest.title,
      end: destEnd + 1
    };
  }

  function matchCodeSpan(source, index) {
    var size = 0;
    while (source.charAt(index + size) === '`') size++;
    if (!size) return null;
    var cursor = index + size;
    while (cursor < source.length) {
      if (source.charAt(cursor) !== '`') {
        cursor++;
        continue;
      }
      var run = 0;
      while (source.charAt(cursor + run) === '`') run++;
      if (run === size) {
        var content = source.slice(index + size, cursor).replace(/\n/g, ' ');
        if (
          content.length >= 2 &&
          content.charAt(0) === ' ' &&
          content.charAt(content.length - 1) === ' ' &&
          content.trim() !== ''
        ) {
          content = content.slice(1, -1);
        }
        return { content: content, end: cursor + run };
      }
      cursor += run;
    }
    return null;
  }

  function restore(value, slots) {
    return value.replace(/\u0000(\d+)\u0000/g, function (_, digits) {
      var index = parseInt(digits, 10);
      return Object.prototype.hasOwnProperty.call(slots, index) ? slots[index] : '';
    });
  }

  function escapeExceptPlaceholders(value) {
    return value
      .split(/(\u0000\d+\u0000)/)
      .map(function (part, index) {
        return index % 2 === 1 ? part : escapeHtml(part);
      })
      .join('');
  }

  function applyEmphasis(value, depth) {
    if (depth > 8) return value;
    var next = value.replace(/\*\*((?:(?!\*\*).)+)\*\*/g, function (full, inner) {
      if (/^\s|\s$/.test(inner)) return full;
      return '<strong>' + applyEmphasis(inner, depth + 1) + '</strong>';
    });
    next = next.replace(/(^|\W)__((?:(?!__).)+)__(?=\W|$)/g, function (full, prefix, inner) {
      if (/^\s|\s$/.test(inner)) return full;
      return prefix + '<strong>' + applyEmphasis(inner, depth + 1) + '</strong>';
    });
    next = next.replace(/(^|\W)\*((?:(?!\*).)+)\*(?=\W|$)/g, function (full, prefix, inner) {
      if (/^\s|\s$/.test(inner)) return full;
      return prefix + '<em>' + applyEmphasis(inner, depth + 1) + '</em>';
    });
    next = next.replace(/(^|\W)_((?:(?!_).)+)_(?=\W|$)/g, function (full, prefix, inner) {
      if (/^\s|\s$/.test(inner)) return full;
      return prefix + '<em>' + applyEmphasis(inner, depth + 1) + '</em>';
    });
    return next;
  }

  function parseInline(source, depth) {
    if (!source) return '';
    if (depth > 12) return escapeHtml(source);
    var slots = [];
    function protect(html) {
      var id = slots.length;
      slots.push(html);
      return '\u0000' + id + '\u0000';
    }

    var out = '';
    var i = 0;
    while (i < source.length) {
      var ch = source.charAt(i);
      if (ch === '\\' && i + 1 < source.length && ESCAPABLE.test(source.charAt(i + 1))) {
        out += protect(escapeHtml(source.charAt(i + 1)));
        i += 2;
        continue;
      }
      if (ch === '`') {
        var code = matchCodeSpan(source, i);
        if (code) {
          out += protect('<code>' + escapeHtml(code.content) + '</code>');
          i = code.end;
          continue;
        }
      }
      if (ch === '!' && source.charAt(i + 1) === '[') {
        var image = matchLink(source, i + 1);
        if (image) {
          out += protect(renderImage(image.label, image.url, image.title));
          i = image.end;
          continue;
        }
      }
      if (ch === '[') {
        var link = matchLink(source, i);
        if (link) {
          out += protect(renderAnchor(parseInline(link.label, depth + 1), link.url, link.title));
          i = link.end;
          continue;
        }
      }
      out += ch;
      i++;
    }

    out = applyEmphasis(escapeExceptPlaceholders(out), 0);
    return restore(out, slots);
  }

  function isBlank(line) {
    return /^[ \t]*$/.test(line);
  }

  function nextNonBlank(lines, index, end) {
    var cursor = index;
    while (cursor < end && isBlank(lines[cursor])) cursor++;
    return cursor < end ? cursor : -1;
  }

  function visualIndent(line) {
    var column = 0;
    for (var i = 0; i < line.length; i++) {
      if (line.charAt(i) === ' ') column += 1;
      else if (line.charAt(i) === '\t') column += 4;
      else break;
    }
    return column;
  }

  function dedent(line, column) {
    var seen = 0;
    var i = 0;
    while (i < line.length && seen < column) {
      if (line.charAt(i) === ' ') seen += 1;
      else if (line.charAt(i) === '\t') seen += 4;
      else break;
      i++;
    }
    return line.slice(i);
  }

  function matchMarker(line) {
    var i = 0;
    var column = 0;
    while (i < line.length && (line.charAt(i) === ' ' || line.charAt(i) === '\t')) {
      column += line.charAt(i) === '\t' ? 4 : 1;
      i++;
    }
    if (column > 3) return null;
    var rest = line.slice(i);
    var unordered = /^([-+*])([ \t]+)(.*)$/.exec(rest);
    if (unordered) {
      return {
        indent: column,
        ordered: false,
        number: 1,
        text: unordered[3],
        contentColumn: column + 1 + visualIndent(unordered[2])
      };
    }
    var ordered = /^(\d{1,9}[.)])([ \t]+)(.*)$/.exec(rest);
    if (ordered) {
      return {
        indent: column,
        ordered: true,
        number: parseInt(ordered[1], 10),
        text: ordered[3],
        contentColumn: column + ordered[1].length + visualIndent(ordered[2])
      };
    }
    return null;
  }

  function matchFenceOpen(line) {
    var match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
    if (!match) return null;
    var fence = match[2];
    var info = match[3];
    if (fence.charAt(0) === '`' && info.indexOf('`') !== -1) return null;
    var word = info.trim().split(/[ \t]+/)[0] || '';
    var lang = /^[A-Za-z0-9_+.#-]{1,32}$/.test(word) ? word : '';
    return { char: fence.charAt(0), len: fence.length, indent: match[1].length, lang: lang };
  }

  function isFenceClose(line, fenceChar, fenceLen) {
    var match = /^( {0,3})(`{3,}|~{3,})[ \t]*$/.exec(line);
    return !!match && match[2].charAt(0) === fenceChar && match[2].length >= fenceLen;
  }

  function isHeading(line) {
    return /^(#{1,6})[ \t]+\S?/.test(line) || /^(#{1,6})[ \t]*$/.test(line) && /^#{1,6}$/.test(line.trim());
  }

  function isHr(line) {
    return /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})[ \t]*$/.test(line);
  }

  function isQuote(line) {
    return /^ {0,3}>/.test(line);
  }

  function stripQuote(line) {
    return line.replace(/^ {0,3}>( ?)/, '');
  }

  function endsWithUnescapedPipe(value) {
    if (value.charAt(value.length - 1) !== '|') return false;
    var slashes = 0;
    for (var i = value.length - 2; i >= 0 && value.charAt(i) === '\\'; i--) slashes++;
    return slashes % 2 === 0;
  }

  function splitCells(line) {
    var source = line.trim();
    var cells = [];
    var current = '';
    var i = source.charAt(0) === '|' ? 1 : 0;
    for (; i < source.length; i++) {
      var ch = source.charAt(i);
      if (ch === '\\' && i + 1 < source.length) {
        current += source.charAt(i + 1);
        i++;
        continue;
      }
      if (ch === '|') {
        cells.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.trim() || !endsWithUnescapedPipe(source)) cells.push(current.trim());
    return cells;
  }

  function isDelimiterRow(line) {
    if (line.indexOf('|') === -1) return false;
    var cells = splitCells(line);
    if (!cells.length) return false;
    for (var i = 0; i < cells.length; i++) {
      if (!/^:?-{3,}:?$/.test(cells[i].trim())) return false;
    }
    return true;
  }

  function isTableStart(lines, index, end) {
    if (index + 1 >= end) return false;
    var header = lines[index];
    if (
      header.indexOf('|') === -1 ||
      isHeading(header) ||
      isQuote(header) ||
      matchFenceOpen(header) ||
      matchMarker(header) ||
      isHr(header)
    ) {
      return false;
    }
    return isDelimiterRow(lines[index + 1]);
  }

  function alignment(cell) {
    var text = cell.trim();
    var left = text.charAt(0) === ':';
    var right = text.charAt(text.length - 1) === ':';
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return '';
  }

  function startsBlock(lines, index, end) {
    var line = lines[index];
    return !!(
      matchFenceOpen(line) ||
      isHeading(line) ||
      isHr(line) ||
      isQuote(line) ||
      matchMarker(line) ||
      isTableStart(lines, index, end)
    );
  }

  function renderHeading(line) {
    var match = /^(#{1,6})[ \t]+([\s\S]*)$/.exec(line);
    if (!match) {
      var empty = /^(#{1,6})[ \t]*$/.exec(line);
      if (!empty) return '';
      var emptyLevel = empty[1].length;
      return '<h' + emptyLevel + '></h' + emptyLevel + '>';
    }
    var level = match[1].length;
    var text = match[2].replace(/[ \t]+#+\s*$/, '').trim();
    return '<h' + level + '>' + parseInline(text, 0) + '</h' + level + '>';
  }

  function tryFence(lines, start, end) {
    var open = matchFenceOpen(lines[start]);
    if (!open) return null;
    var body = [];
    var i = start + 1;
    while (i < end) {
      if (isFenceClose(lines[i], open.char, open.len)) {
        i++;
        break;
      }
      body.push(dedent(lines[i], open.indent));
      i++;
    }
    var langAttr = open.lang ? ' data-language="' + escapeHtml(open.lang) + '"' : '';
    return {
      html: '<pre' + langAttr + '><code>' + escapeHtml(body.join('\n')) + '</code></pre>',
      next: i
    };
  }

  function tryTable(lines, start, end) {
    if (!isTableStart(lines, start, end)) return null;
    var header = splitCells(lines[start]);
    var aligns = splitCells(lines[start + 1]).map(alignment);
    var rows = [];
    var i = start + 2;
    while (i < end && !isBlank(lines[i])) {
      var line = lines[i];
      if (
        isHeading(line) ||
        matchFenceOpen(line) ||
        isHr(line) ||
        isQuote(line) ||
        matchMarker(line) ||
        line.indexOf('|') === -1
      ) {
        break;
      }
      rows.push(splitCells(line));
      i++;
    }
    var width = header.length;
    rows.forEach(function (row) {
      if (row.length > width) width = row.length;
    });
    function cell(tag, text, align) {
      var classAttr = align ? ' class="align-' + align + '"' : '';
      return '<' + tag + classAttr + '>' + parseInline(text || '', 0) + '</' + tag + '>';
    }
    var head = '<thead>\n<tr>';
    for (var column = 0; column < width; column++) {
      head += cell('th', header[column] || '', aligns[column] || '');
    }
    head += '</tr>\n</thead>';
    var body = '';
    if (rows.length) {
      body =
        '\n<tbody>\n' +
        rows
          .map(function (row) {
            var html = '<tr>';
            for (var column = 0; column < width; column++) {
              html += cell('td', row[column] || '', aligns[column] || '');
            }
            return html + '</tr>';
          })
          .join('\n') +
        '\n</tbody>';
    }
    return { html: '<table>\n' + head + body + '\n</table>', next: i };
  }

  function tryQuote(lines, start, end, depth) {
    if (!isQuote(lines[start])) return null;
    var inner = [];
    var i = start;
    while (i < end) {
      if (isBlank(lines[i])) {
        var next = nextNonBlank(lines, i, end);
        if (next !== -1 && isQuote(lines[next])) {
          inner.push('');
          i++;
          continue;
        }
        break;
      }
      if (!isQuote(lines[i])) break;
      inner.push(stripQuote(lines[i]));
      i++;
    }
    var html = parseBlocks(inner, 0, inner.length, depth).html;
    return { html: '<blockquote>\n' + html + '\n</blockquote>', next: i };
  }

  function tighten(html) {
    var match = /^<p>([\s\S]*?)<\/p>([\s\S]*)$/.exec(html);
    if (!match) return html;
    var rest = match[2];
    if (rest.charAt(0) === '\n') rest = rest.slice(1);
    return rest ? match[1] + '\n' + rest : match[1];
  }

  function tryList(lines, start, end, depth) {
    if (depth > 1) return null;
    var first = matchMarker(lines[start]);
    if (!first) return null;
    var ordered = first.ordered;
    var listIndent = first.indent;
    var bodies = [];
    var numbers = [];
    var i = start;
    var tight = true;

    while (i < end) {
      if (isBlank(lines[i])) {
        var following = nextNonBlank(lines, i, end);
        var peek = following === -1 ? null : matchMarker(lines[following]);
        if (peek && peek.ordered === ordered && peek.indent === listIndent) {
          tight = false;
          i = following;
          continue;
        }
        break;
      }

      var marker = matchMarker(lines[i]);
      if (!marker || marker.ordered !== ordered || marker.indent !== listIndent) break;
      var itemLines = [marker.text];
      i++;
      while (i < end) {
        if (isBlank(lines[i])) {
          var content = nextNonBlank(lines, i, end);
          if (content === -1) {
            i = end;
            break;
          }
          var ahead = matchMarker(lines[content]);
          if (ahead && ahead.ordered === ordered && ahead.indent === listIndent) break;
          if (visualIndent(lines[content]) > listIndent) {
            while (i < content) {
              itemLines.push('');
              i++;
            }
            continue;
          }
          break;
        }
        if (visualIndent(lines[i]) <= listIndent) break;
        itemLines.push(dedent(lines[i], marker.contentColumn));
        i++;
      }
      if (itemLines.some(function (line) { return line === ''; })) tight = false;
      bodies.push(itemLines);
      numbers.push(marker.number);
    }

    if (!bodies.length) return null;
    var tag = ordered ? 'ol' : 'ul';
    var startAttr = ordered && numbers[0] !== 1 ? ' start="' + numbers[0] + '"' : '';
    var items = bodies
      .map(function (body) {
        var inner = parseBlocks(body, 0, body.length, depth + 1).html;
        return '<li>' + (tight ? tighten(inner) : inner) + '</li>';
      })
      .join('\n');
    return { html: '<' + tag + startAttr + '>\n' + items + '\n</' + tag + '>', next: i };
  }

  function tryParagraph(lines, start, end) {
    var buf = [lines[start]];
    var i = start + 1;
    while (i < end && !isBlank(lines[i]) && !startsBlock(lines, i, end)) {
      buf.push(lines[i]);
      i++;
    }
    var text = buf
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return line.length > 0; })
      .join(' ');
    return { html: '<p>' + parseInline(text, 0) + '</p>', next: i };
  }

  function parseBlocks(lines, start, end, depth) {
    var parts = [];
    var i = start;
    while (i < end) {
      if (isBlank(lines[i])) {
        i++;
        continue;
      }
      var fence = tryFence(lines, i, end);
      if (fence) {
        parts.push(fence.html);
        i = fence.next > i ? fence.next : i + 1;
        continue;
      }
      if (isHeading(lines[i])) {
        parts.push(renderHeading(lines[i]));
        i++;
        continue;
      }
      if (isHr(lines[i])) {
        parts.push('<hr>');
        i++;
        continue;
      }
      var table = tryTable(lines, i, end);
      if (table) {
        parts.push(table.html);
        i = table.next > i ? table.next : i + 1;
        continue;
      }
      var quote = tryQuote(lines, i, end, depth);
      if (quote) {
        parts.push(quote.html);
        i = quote.next > i ? quote.next : i + 1;
        continue;
      }
      var list = tryList(lines, i, end, depth);
      if (list) {
        parts.push(list.html);
        i = list.next > i ? list.next : i + 1;
        continue;
      }
      var paragraph = tryParagraph(lines, i, end);
      parts.push(paragraph.html);
      i = paragraph.next > i ? paragraph.next : i + 1;
    }
    return { html: parts.join('\n'), next: i };
  }

  function renderMarkdown(input) {
    var source = input == null ? '' : String(input);
    source = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u0000/g, '\uFFFD');
    if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
    if (!source) return '';
    return parseBlocks(source.split('\n'), 0, source.split('\n').length, 0).html;
  }

  return { render: renderMarkdown };
});
