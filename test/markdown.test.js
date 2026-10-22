/* Renderer tests. Run with: node test/markdown.test.js
 * Or open test/run.html in a browser (after js/markdown.js). */
(function (root) {
  'use strict';

  var md = null;
  if (typeof window !== 'undefined' && window.SimpleMarkdown) {
    md = window.SimpleMarkdown;
  } else if (typeof require === 'function') {
    md = require('../js/markdown.js');
  }

  var tests = [];

  function test(name, fn) {
    tests.push({ name: name, fn: fn });
  }

  function fail(message) {
    var error = new Error(message);
    error.name = 'AssertionError';
    throw error;
  }

  function assertEqual(actual, expected) {
    if (actual !== expected) {
      fail('expected:\n' + expected + '\nactual:\n' + actual);
    }
  }

  function assertIncludes(html, needle) {
    if (html.indexOf(needle) === -1) fail('missing ' + needle + '\nHTML:\n' + html);
  }

  function assertExcludes(html, needle) {
    if (html.indexOf(needle) !== -1) fail('unexpected ' + needle + '\nHTML:\n' + html);
  }

  function count(haystack, needle) {
    var found = 0;
    var index = 0;
    while ((index = haystack.indexOf(needle, index)) !== -1) {
      found++;
      index += needle.length;
    }
    return found;
  }

  function assertNoExecutableHtml(html) {
    if (/<\s*script/i.test(html)) fail('raw script tag in output:\n' + html);
    if (/<[a-z][^>]*\son\w+\s*=/i.test(html)) fail('inline handler in output:\n' + html);
    if (/href\s*=\s*["']\s*javascript:/i.test(html)) fail('javascript href:\n' + html);
    if (/href\s*=\s*["']\s*vbscript:/i.test(html)) fail('vbscript href:\n' + html);
    if (/href\s*=\s*["']\s*data:/i.test(html)) fail('data href:\n' + html);
    if (/src\s*=\s*["']\s*javascript:/i.test(html)) fail('javascript src:\n' + html);
    if (/src\s*=\s*["']\s*vbscript:/i.test(html)) fail('vbscript src:\n' + html);
  }

  var render = function (source) {
    var html = md.render(source);
    assertNoExecutableHtml(html);
    return html;
  };

  test('headings h1 through h6', function () {
    assertEqual(render('# Hello'), '<h1>Hello</h1>');
    assertEqual(render('## Hello'), '<h2>Hello</h2>');
    assertEqual(render('### Hello'), '<h3>Hello</h3>');
    assertEqual(render('#### Hello'), '<h4>Hello</h4>');
    assertEqual(render('##### Hello'), '<h5>Hello</h5>');
    assertEqual(render('###### Hello'), '<h6>Hello</h6>');
    assertEqual(render('## Hello ##'), '<h2>Hello</h2>');
    assertEqual(render('####### Seven'), '<p>####### Seven</p>');
    assertEqual(render('#NoSpace'), '<p>#NoSpace</p>');
  });

  test('paragraphs join single newlines and split on blank lines', function () {
    assertEqual(render('a\nb'), '<p>a b</p>');
    assertEqual(render('a\n\nb'), '<p>a</p>\n<p>b</p>');
    assertEqual(render(''), '');
    assertEqual(render(null), '');
  });

  test('bold, italic, and inline code', function () {
    assertEqual(render('**b**'), '<p><strong>b</strong></p>');
    assertEqual(render('__b__'), '<p><strong>b</strong></p>');
    assertEqual(render('*i*'), '<p><em>i</em></p>');
    assertEqual(render('_e_'), '<p><em>e</em></p>');
    assertEqual(render('snake_case'), '<p>snake_case</p>');
    assertEqual(render('`c`'), '<p><code>c</code></p>');
    assertEqual(render('A **b** *c* `d`'), '<p>A <strong>b</strong> <em>c</em> <code>d</code></p>');
    assertEqual(render('**b *i* b**'), '<p><strong>b <em>i</em> b</strong></p>');
    assertEqual(render('`**not bold**`'), '<p><code>**not bold**</code></p>');
    assertEqual(render('\\*not\\*'), '<p>*not*</p>');
  });

  test('fenced code is literal', function () {
    assertEqual(
      render('```js\n**no**\n<script>alert(1)</script>\n```'),
      '<pre data-language="js"><code>**no**\n&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>'
    );
    assertEqual(render('```"><script>\nalert(1)\n```'), '<pre><code>alert(1)</code></pre>');
  });

  test('links and images', function () {
    assertEqual(
      render('[ex](https://example.com)'),
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">ex</a></p>'
    );
    assertIncludes(
      render('[a](https://example.com?a=1&b=2)'),
      'href="https://example.com?a=1&amp;b=2"'
    );
    assertIncludes(render('[m](mailto:a@b.com)'), 'href="mailto:a@b.com"');
    assertEqual(
      render('[**a**](https://example.com)'),
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer"><strong>a</strong></a></p>'
    );
    assertEqual(
      render('![alt](data:image/png;base64,aaaa)'),
      '<p><img src="data:image/png;base64,aaaa" alt="alt"></p>'
    );
    assertIncludes(render('![a"b](data:image/png;base64,aa)'), 'alt="a&quot;b"');
  });

  test('dangerous URLs are neutralised', function () {
    var cases = [
      '[x](javascript:alert(1))',
      '[x](JAVASCRIPT:alert(1))',
      '[x]( javascript:alert(1))',
      '[x](java\tscript:alert(1))',
      '[x](javascript%3Aalert(1))',
      '[x](javascript&#58;alert(1))',
      '[x](&#106;avascript:alert(1))',
      '[x](javascript&colon;alert(1))',
      '[x](vbscript:msgbox(1))',
      '[x](data:text/html,hi)'
    ];
    cases.forEach(function (source) {
      assertEqual(render(source), '<p><span class="blocked-link">x</span></p>');
    });
    assertEqual(render('![alt](javascript:alert(1))'), '<p><span class="blocked-image">alt</span></p>');
    assertEqual(render('![alt](vbscript:msgbox(1))'), '<p><span class="blocked-image">alt</span></p>');
    var broken = render('[a](https://example.com/"onclick="alert(1))');
    assertIncludes(broken, 'href="https://example.com/&quot;onclick=&quot;alert(1)"');
  });

  test('raw HTML is text', function () {
    assertEqual(render('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    assertEqual(render('# <script>alert(1)</script>'), '<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1>');
    assertIncludes(render('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  });

  test('blockquote, rule, and table', function () {
    assertEqual(render('> **hi**\n> there'), '<blockquote>\n<p><strong>hi</strong> there</p>\n</blockquote>');
    assertEqual(render('> a\n>\n> b'), '<blockquote>\n<p>a</p>\n<p>b</p>\n</blockquote>');
    assertEqual(render('a\n\n---\n\nb'), '<p>a</p>\n<hr>\n<p>b</p>');
    ['---', '***', '___', '- - -', '* * *'].forEach(function (rule) {
      assertEqual(render(rule), '<hr>');
    });
    var table = render('| a | **b** |\n| --- | ---: |\n| c | d |\n| e | f |');
    assertIncludes(table, '<th>a</th>');
    assertIncludes(table, '<th class="align-right"><strong>b</strong></th>');
    assertIncludes(table, '<td class="align-right">d</td>');
    assertIncludes(table, '<td>e</td>');
    var aligned = render('| L | C | R |\n| :--- | :---: | ---: |\n| l | c | r |');
    assertIncludes(aligned, '<th class="align-left">L</th>');
    assertIncludes(aligned, '<th class="align-center">C</th>');
    assertIncludes(aligned, '<td class="align-right">r</td>');
    assertEqual(render('a | b'), '<p>a | b</p>');
    assertIncludes(render('| a \\| b | c |\n| --- | --- |\n| d | e |'), '<th>a | b</th>');
  });

  test('lists with one level of nesting', function () {
    var unordered = render('- a\n- b\n  - c\n  - d\n- e');
    assertEqual(count(unordered, '<ul>'), 2);
    assertIncludes(unordered, '<li>a</li>');
    assertIncludes(unordered, '<li>c</li>');
    assertIncludes(unordered, '<li>e</li>');

    var ordered = render('1. a\n2. b\n   1. c\n   2. d');
    assertIncludes(ordered, '<ol>');
    assertIncludes(ordered, '<li>a</li>');
    assertIncludes(ordered, '<li>c</li>');
    assertEqual(count(ordered, '<ol>'), 2);

    assertIncludes(render('3. c\n4. d'), '<ol start="3">');

    var mixed = render('- parent\n  1. child\n  2. other');
    assertIncludes(mixed, '<ul>');
    assertIncludes(mixed, '<ol>');
    assertIncludes(mixed, '<li>child</li>');

    var deep = render('- a\n  - b\n    - c');
    assertEqual(count(deep, '<ul>'), 2);
    assertIncludes(deep, '- c');
    assertExcludes(deep, '<ul>\n<li>c</li>\n</ul>\n</li>\n</ul>\n</li>');
  });

  test('crlf input matches lf input', function () {
    assertEqual(render('# Hi\r\n\r\n**yo**'), render('# Hi\n\n**yo**'));
  });

  function run() {
    if (!md || typeof md.render !== 'function') {
      return { failed: 1, total: 1, report: 'FAIL renderer missing' };
    }
    var failed = 0;
    var lines = [];
    tests.forEach(function (item) {
      try {
        item.fn();
        lines.push('ok ' + item.name);
      } catch (err) {
        failed++;
        lines.push('FAIL ' + item.name + '\n' + (err && err.stack ? err.stack : err));
      }
    });
    lines.push(tests.length - failed + ' passed, ' + failed + ' failed');
    return { failed: failed, total: tests.length, report: lines.join('\n') };
  }

  if (typeof module === 'object' && module && module.exports && typeof window === 'undefined') {
    var result = run();
    console.log(result.report);
    if (result.failed) process.exitCode = 1;
  } else if (typeof window !== 'undefined') {
    window.runMarkdownTests = run;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
