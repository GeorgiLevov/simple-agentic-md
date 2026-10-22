# simple-agentic-md

A single-page Markdown editor with a live side-by-side preview. It is plain HTML, CSS, and JavaScript: no build step, no backend, and no dependencies. The word “agentic” means the app was built by an agent. There are no AI features.

## Use it

Open `index.html` in a browser, or serve this folder as static files (including GitHub Pages from the repository root). Relative asset paths are used so both `file://` and a project-site URL work.

- **New** clears the editor. If there is any text, the browser asks you to confirm.
- **Open** loads a local `.md`, `.markdown`, or `.txt` file. Opening asks for confirmation when the editor is not empty.
- **Download** saves the current editor text as a `.md` file. Ctrl+S or Cmd+S does the same.
- Tab inserts two spaces. Shift+Tab removes up to two spaces before the caret.
- The document autosaves in `localStorage` and is restored on reload. If storage is unavailable or full, editing still works and a dismissible notice explains that the text will not be kept.
- The first visit, with nothing stored, loads a sample that uses every supported syntax.

## Syntax

The preview understands:

- ATX headings `h1`–`h6` (a space is required after the hashes)
- Paragraphs
- `**bold**` / `__bold__` and `*italic*` / `_italic_`
- Inline code and fenced code blocks
- Links and images
- Blockquotes
- Ordered and unordered lists, including one nested level (deeper markers stay as text)
- Horizontal rules (`---`, `***`, `___`, including spaced forms)
- GitHub-style pipe tables, with `:---` alignment

Raw HTML is shown as text. `javascript:` and `vbscript:` URLs are not used for links or images. `data:` URLs are not used for links (they are allowed on images, so the sample swatch can load offline).

## Tests

```bash
node test/markdown.test.js
```

Or open `test/run.html` in a browser.

## Layout

Dark theme only. The editor and the preview use an 18px base size, with a monospace face for the editor and for code. The layout targets a desktop window about 1024px wide or wider.
