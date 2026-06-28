// The ONE markdown-rendering authority. Every UI surface that shows message text
// renders through here — never ad-hoc. Messages come from arbitrary peers, so the
// output is ALWAYS sanitized (DOMPurify) before it can reach innerHTML: marked
// produces HTML, DOMPurify strips anything dangerous (scripts, event handlers,
// javascript: URLs, raw <iframe>, etc.). No render path bypasses this.

import { Marked } from "marked"
import DOMPurify, { type Config } from "dompurify"

// Full GitHub-flavored markdown. `breaks: true` so a single newline becomes <br>
// (chat messages treat line breaks literally, matching the pre-wrap behavior the
// plain renderer had). gfm enables tables, strikethrough, autolinks, task lists.
const md = new Marked({ gfm: true, breaks: true })

// Sanitizer config shared by block + inline. We allow the GFM element set marked
// emits and nothing that can execute. Links are kept but forced safe (no
// javascript:) and opened in a new tab with noopener.
const PURIFY_OPTS: Config = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "em", "del", "code", "pre", "blockquote",
    "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "h5", "h6",
    "table", "thead", "tbody", "tr", "th", "td", "hr", "input",
  ],
  ALLOWED_ATTR: ["href", "title", "type", "checked", "disabled"],
  // task-list checkboxes marked emits are <input type=checkbox disabled>; keep them inert.
}

// Harden links: every anchor that survives sanitization gets target=_blank +
// rel=noopener noreferrer. Registered once at module load. This module is a
// singleton (imported once in the browser SPA), so the hook is added exactly
// once — DOMPurify does NOT dedupe hooks by function identity, so never call
// addHook again for this hook.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank")
    node.setAttribute("rel", "noopener noreferrer")
  }
})

// Render full block-level markdown to sanitized HTML. Used in message bubbles.
export function renderMarkdown(text: string): string {
  const html = md.parse(text, { async: false }) as string
  return DOMPurify.sanitize(html, PURIFY_OPTS)
}

// Render INLINE markdown only (bold/italic/code/links/strikethrough) to sanitized
// HTML, with no surrounding block wrapper — for one-line surfaces (conversation
// previews, reply-quote snippets) where block structure (lists, code fences,
// headings) would break the single-line layout. marked.parseInline skips the
// block grammar; we still sanitize.
export function renderInlineMarkdown(text: string): string {
  // Collapse hard line breaks to spaces first so a multi-line message stays on one
  // line in a preview/snippet context.
  const oneLine = text.replace(/\s*\n+\s*/g, " ").trim()
  const html = md.parseInline(oneLine, { async: false }) as string
  return DOMPurify.sanitize(html, PURIFY_OPTS)
}
