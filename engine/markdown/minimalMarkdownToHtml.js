/**
 * Minimal Markdown → HTML: no dependencies, DOM-agnostic.
 * Supports: `#`–`###` headings, paragraphs, `-` lists, `**bold**`, `[label](https://…)`.
 *
 * @typedef {object} MinimalMdHtmlClasses
 * @property {string} [paragraph]
 * @property {string} [h2]
 * @property {string} [h3]
 * @property {string} [h4]
 * @property {string} [ul]
 * @property {string} [li]
 * @property {string} [link]
 * @property {string} [strong]
 */

/** @param {string} s */
export function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {string | undefined} c */
function classAttr(c) {
  return c ? ` class="${escapeHtml(c)}"` : '';
}

/**
 * Inline: **bold** and [label](https://…).
 * @param {string} raw
 * @param {MinimalMdHtmlClasses} classes
 */
function inlineMarkdown(raw, classes) {
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const linkCls = classAttr(classes.link);
  const strongCls = classes.strong ?? '';

  /** @param {string} escapedNoTags */
  function boldSegments(escapedNoTags) {
    const parts = escapedNoTags.split(/\*\*/);
    return parts
      .map((p, i) =>
        i % 2 === 1
          ? `<strong${classAttr(strongCls)}>${p}</strong>`
          : p,
      )
      .join('');
  }

  /** @type {string[]} */
  const out = [];
  let last = 0;
  let m;
  while ((m = linkRe.exec(raw)) !== null) {
    if (m.index > last) {
      out.push(boldSegments(escapeHtml(raw.slice(last, m.index))));
    }
    out.push(
      `<a${linkCls} href="${escapeHtml(m[2])}" target="_blank" rel="noopener noreferrer">${boldSegments(escapeHtml(m[1]))}</a>`,
    );
    last = m.index + m[0].length;
  }
  if (last < raw.length) {
    out.push(boldSegments(escapeHtml(raw.slice(last))));
  }
  return out.join('');
}

/**
 * @param {string} md
 * @param {MinimalMdHtmlClasses} [classes]
 * @returns {string}
 */
export function minimalMarkdownToHtml(md, classes = {}) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  /** @type {string[]} */
  const html = [];
  /** @type {string[]} */
  let para = [];
  let inUl = false;

  const c = classes;

  function closeUl() {
    if (inUl) {
      html.push(`</ul>`);
      inUl = false;
    }
  }

  function flushPara() {
    if (!para.length) return;
    closeUl();
    const text = para.join(' ');
    para = [];
    html.push(`<p${classAttr(c.paragraph)}>${inlineMarkdown(text, c)}</p>`);
  }

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      flushPara();
      continue;
    }
    if (t.startsWith('### ')) {
      flushPara();
      closeUl();
      html.push(`<h4${classAttr(c.h4)}>${inlineMarkdown(t.slice(4), c)}</h4>`);
      continue;
    }
    if (t.startsWith('## ')) {
      flushPara();
      closeUl();
      html.push(`<h3${classAttr(c.h3)}>${inlineMarkdown(t.slice(3), c)}</h3>`);
      continue;
    }
    if (t.startsWith('# ')) {
      flushPara();
      closeUl();
      html.push(`<h2${classAttr(c.h2)}>${inlineMarkdown(t.slice(2), c)}</h2>`);
      continue;
    }
    if (t.startsWith('- ')) {
      flushPara();
      if (!inUl) {
        html.push(`<ul${classAttr(c.ul)}>`);
        inUl = true;
      }
      html.push(`<li${classAttr(c.li)}>${inlineMarkdown(t.slice(2), c)}</li>`);
      continue;
    }
    para.push(t);
  }
  flushPara();
  closeUl();
  return html.join('');
}
