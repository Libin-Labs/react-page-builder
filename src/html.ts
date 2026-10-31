import {
  isSafeUrl,
  validatePageDocument,
  type BlockStyle,
  type PageBlock,
  type PageContentBlock,
  type PageDocument,
} from './model.js';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function styleAttribute(style: BlockStyle | undefined): string {
  if (!style) return '';
  const entries = [
    style.color ? `color:${style.color}` : '',
    style.backgroundColor ? `background-color:${style.backgroundColor}` : '',
    style.padding !== undefined ? `padding:${style.padding}px` : '',
    style.textAlign ? `text-align:${style.textAlign}` : '',
    style.fontSize !== undefined ? `font-size:${style.fontSize}px` : '',
  ].filter(Boolean);
  return entries.length ? ` style="${escapeHtml(entries.join(';'))}"` : '';
}

function contentHtml(block: PageContentBlock): string {
  const style = styleAttribute(block.style);
  switch (block.type) {
    case 'text':
      return `<p${style}>${escapeHtml(block.text)}</p>`;
    case 'heading':
      return `<h${block.level}${style}>${escapeHtml(block.text)}</h${block.level}>`;
    case 'image':
      return isSafeUrl(block.src)
        ? `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}"${style}>`
        : '';
    case 'button':
      return isSafeUrl(block.href)
        ? `<a href="${escapeHtml(block.href)}"${style}>${escapeHtml(block.text)}</a>`
        : '';
    case 'spacer':
      return `<div aria-hidden="true" style="height:${block.height}px"></div>`;
  }
}

function blockHtml(block: PageBlock): string {
  if (block.type !== 'section') return contentHtml(block);
  return `<section${styleAttribute(block.style)}>${block.children.map(contentHtml).join('')}</section>`;
}

export function renderPageHtml(document: PageDocument): string {
  const issues = validatePageDocument(document);
  if (issues.length)
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page</title></head><body>${document.blocks.map(blockHtml).join('')}</body></html>`;
}
