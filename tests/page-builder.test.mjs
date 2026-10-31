import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import {
  parsePageDocument,
  renderPageHtml,
  serializePageDocument,
  validatePageDocument,
} from '../dist/esm/index.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://editor.example/',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { createRoot } = await import('react-dom/client');
const { act } = React;

const valid = {
  version: 1,
  blocks: [
    {
      id: 'section',
      type: 'section',
      style: { backgroundColor: '#fff' },
      children: [
        { id: 'heading', type: 'heading', level: 2, text: 'Hello <there>' },
        { id: 'button', type: 'button', text: 'Go', href: 'https://example.com?a=1&b=2' },
      ],
    },
  ],
};

test('validates and round-trips the supported versioned page schema', () => {
  assert.deepEqual(validatePageDocument(valid), []);
  assert.deepEqual(parsePageDocument(serializePageDocument(valid)), valid);
  assert.throws(() => parsePageDocument('{'), /not valid JSON/);
});

test('HTML renderer escapes content and attributes and rejects unsafe link schemes', () => {
  const html = renderPageHtml(valid);
  assert.match(html, /Hello &lt;there&gt;/);
  assert.match(html, /https:\/\/example\.com\?a=1&amp;b=2/);
  const bad = {
    version: 1,
    blocks: [{ id: 'x', type: 'button', text: '<img>', href: 'javascript:alert(1)' }],
  };
  assert.match(validatePageDocument(bad)[0].message, /unsafe scheme/);
  assert.throws(() => renderPageHtml(bad), /unsafe scheme/);
  assert.doesNotMatch(html, /<script/i);
});

test('validation detects duplicate ids, invalid styles, and unsupported block types', () => {
  const issues = validatePageDocument({
    version: 1,
    blocks: [
      { id: 'same', type: 'text', text: 'one', style: { color: 'red' } },
      { id: 'same', type: 'other' },
    ],
  });
  assert.equal(issues.length, 3);
  assert.match(issues.map((issue) => issue.message).join(' '), /Style contains unsupported/);
  assert.match(issues.map((issue) => issue.message).join(' '), /unique/);
  assert.match(issues.map((issue) => issue.message).join(' '), /Unsupported block type/);
});

test('editor adds, selects, edits, serializes, and undoes a block through the DOM', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(React.createElement((await import('../dist/esm/index.js')).PageBuilder)),
  );
  const addButton = [...host.querySelectorAll('button')].find(
    (button) => button.textContent === 'Add text',
  );
  assert.ok(addButton);
  await act(async () => addButton.click());
  const textField = host.querySelector('textarea[aria-label="Text"]');
  assert.ok(textField);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(
      textField,
      'Edited <safe>',
    );
    textField.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    textField.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  assert.match(host.querySelector('textarea[aria-label="JSON output"]').value, /Edited <safe>/);
  assert.match(
    host.querySelector('textarea[aria-label="HTML export"]').value,
    /Edited &lt;safe&gt;/,
  );
  await act(async () => host.querySelector('button[aria-label="Undo"]').click());
  assert.match(
    host.querySelector('textarea[aria-label="JSON output"]').value,
    /Write your text here/,
  );
  await act(async () => root.unmount());
  host.remove();
});

after(() => dom.window.close());
