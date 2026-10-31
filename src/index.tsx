import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { renderPageHtml } from './html.js';
import { isSafeUrl } from './model.js';
import {
  serializePageDocument,
  validatePageDocument,
  type BlockStyle,
  type PageBlock,
  type PageContentBlock,
  type PageDocument,
} from './model.js';
export * from './model.js';
export { escapeHtml, renderPageHtml } from './html.js';

export interface PageBuilderProps {
  value?: PageDocument;
  defaultValue?: PageDocument;
  onChange?: (document: PageDocument) => void;
  className?: string;
}

const emptyDocument: PageDocument = { version: 1, blocks: [] };
let nextId = 0;
const makeId = () => `page-block-${Date.now().toString(36)}-${(++nextId).toString(36)}`;
const labels = ['section', 'text', 'heading', 'image', 'button', 'spacer'] as const;
type PageKind = (typeof labels)[number];

function createBlock(type: PageKind): PageBlock {
  const id = makeId();
  switch (type) {
    case 'section':
      return { id, type, children: [] };
    case 'text':
      return { id, type, text: 'Write your text here' };
    case 'heading':
      return { id, type, text: 'New heading', level: 2 };
    case 'image':
      return { id, type, src: '', alt: 'Describe this image' };
    case 'button':
      return { id, type, text: 'Learn more', href: 'https://example.com' };
    case 'spacer':
      return { id, type, height: 32 };
  }
}

function blockTitle(block: PageBlock): string {
  if (block.type === 'heading' || block.type === 'text' || block.type === 'button')
    return `${block.type}: ${block.text || '(empty)'}`;
  if (block.type === 'image') return `image: ${block.alt || '(no alt text)'}`;
  return block.type;
}

function updateBlock(
  document: PageDocument,
  id: string,
  update: (block: PageBlock) => PageBlock,
): PageDocument {
  return {
    ...document,
    blocks: document.blocks.map((block) => {
      if (block.id === id) return update(block);
      if (block.type === 'section')
        return {
          ...block,
          children: block.children.map((child) =>
            child.id === id ? (update(child) as PageContentBlock) : child,
          ),
        };
      return block;
    }),
  };
}

function moveBlock(document: PageDocument, id: string, direction: -1 | 1): PageDocument {
  const move = <T extends PageBlock | PageContentBlock>(list: T[]): T[] => {
    const index = list.findIndex((block) => block.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return list;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };
  const blocks = document.blocks.some((block) => block.id === id)
    ? move(document.blocks)
    : document.blocks.map((block) =>
        block.type === 'section' ? { ...block, children: move(block.children) } : block,
      );
  return { ...document, blocks };
}

function styleOf(block: PageBlock): CSSProperties {
  const style = block.style;
  return {
    color: style?.color,
    backgroundColor: style?.backgroundColor,
    padding: style?.padding,
    textAlign: style?.textAlign,
    fontSize: style?.fontSize,
  };
}

function PreviewBlock({ block }: { block: PageBlock }): ReactNode {
  const style = styleOf(block);
  if (block.type === 'section')
    return (
      <section className="lp-page-preview-section" style={style}>
        {block.children.map((child) => (
          <PreviewContent key={child.id} block={child} />
        ))}
      </section>
    );
  return <PreviewContent block={block} />;
}

function PreviewContent({ block }: { block: PageContentBlock }): ReactNode {
  const style = styleOf(block);
  switch (block.type) {
    case 'text':
      return <p style={style}>{block.text}</p>;
    case 'heading': {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
      return <Tag style={style}>{block.text}</Tag>;
    }
    case 'image':
      return isSafeUrl(block.src) ? (
        <img src={block.src} alt={block.alt} style={{ ...style, maxWidth: '100%' }} />
      ) : (
        <span>Unsafe image URL</span>
      );
    case 'button':
      return isSafeUrl(block.href) ? (
        <a href={block.href} style={style}>
          {block.text}
        </a>
      ) : (
        <span>{block.text}</span>
      );
    case 'spacer':
      return <div aria-hidden="true" style={{ height: block.height }} />;
  }
}

export function PageBuilder({
  value,
  defaultValue = emptyDocument,
  onChange,
  className,
}: PageBuilderProps) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState<PageDocument>(defaultValue);
  const document = controlled ? value : internal;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [history, setHistory] = useState<PageDocument[]>([]);
  const [future, setFuture] = useState<PageDocument[]>([]);
  const selected = useMemo(() => {
    for (const block of document.blocks) {
      if (block.id === selectedId) return block;
      if (block.type === 'section') {
        const found = block.children.find((child) => child.id === selectedId);
        if (found) return found;
      }
    }
    return undefined;
  }, [document, selectedId]);
  const latest = useRef(document);
  latest.current = document;
  const apply = (next: PageDocument, saveHistory = true) => {
    if (saveHistory) {
      setHistory((items) => [...items.slice(-49), latest.current]);
      setFuture([]);
    }
    if (!controlled) setInternal(next);
    onChange?.(next);
  };
  const add = (kind: PageKind) => {
    const block = createBlock(kind);
    let next: PageDocument;
    if (kind !== 'section' && selected?.type === 'section') {
      next = updateBlock(document, selected.id, (section) =>
        section.type === 'section'
          ? { ...section, children: [...section.children, block as PageContentBlock] }
          : section,
      );
    } else next = { ...document, blocks: [...document.blocks, block] };
    setSelectedId(block.id);
    apply(next);
  };
  const remove = (id: string) => {
    apply({
      ...document,
      blocks: document.blocks
        .filter((block) => block.id !== id)
        .map((block) =>
          block.type === 'section'
            ? { ...block, children: block.children.filter((child) => child.id !== id) }
            : block,
        ),
    });
    if (selectedId === id) setSelectedId(null);
  };
  const alter = (changes: Partial<PageBlock>) => {
    if (selected)
      apply(updateBlock(document, selected.id, (block) => ({ ...block, ...changes }) as PageBlock));
  };
  const alterStyle = (key: keyof BlockStyle, entry: string) => {
    if (!selected) return;
    const previous = selected.style ?? {};
    const valueForKey = key === 'padding' || key === 'fontSize' ? Number(entry) : entry;
    alter({ style: { ...previous, [key]: valueForKey } });
  };
  const undo = () => {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setFuture((items) => [...items, document]);
    apply(previous, false);
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[future.length - 1];
    setFuture(future.slice(0, -1));
    setHistory((items) => [...items, document]);
    apply(next, false);
  };
  const issues = validatePageDocument(document);
  let html = '';
  try {
    html = renderPageHtml(document);
  } catch {
    html = '';
  }
  const updateText = (key: 'text' | 'alt' | 'href' | 'src', entry: string) =>
    alter({ [key]: entry } as Partial<PageBlock>);
  return (
    <div className={`lp-page-builder${className ? ` ${className}` : ''}`}>
      <header className="lp-page-toolbar">
        <strong>Page builder</strong>
        <button type="button" onClick={undo} disabled={!history.length} aria-label="Undo">
          Undo
        </button>
        <button type="button" onClick={redo} disabled={!future.length} aria-label="Redo">
          Redo
        </button>
        <label>
          Preview width
          <select
            aria-label="Preview width"
            value={viewport}
            onChange={(event) => setViewport(event.target.value as typeof viewport)}
          >
            <option value="desktop">Desktop</option>
            <option value="tablet">Tablet</option>
            <option value="mobile">Mobile</option>
          </select>
        </label>
      </header>
      <div className="lp-page-workspace">
        <aside className="lp-page-panel" aria-label="Block palette">
          <h2>Add a block</h2>
          <div className="lp-page-palette">
            {labels.map((kind) => (
              <button key={kind} type="button" onClick={() => add(kind)}>
                Add {kind}
              </button>
            ))}
          </div>
          <h2>Document</h2>
          <ol className="lp-page-outline">
            {document.blocks.map((block, index) => (
              <li key={block.id}>
                <button
                  type="button"
                  aria-pressed={selectedId === block.id}
                  onClick={() => setSelectedId(block.id)}
                >
                  {blockTitle(block)}
                </button>
                <button
                  type="button"
                  aria-label={`Move ${block.type} up`}
                  disabled={index === 0}
                  onClick={() => apply(moveBlock(document, block.id, -1))}
                >
                  Up
                </button>
                <button
                  type="button"
                  aria-label={`Move ${block.type} down`}
                  disabled={index === document.blocks.length - 1}
                  onClick={() => apply(moveBlock(document, block.id, 1))}
                >
                  Down
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${block.type}`}
                  onClick={() => remove(block.id)}
                >
                  Remove
                </button>
                {block.type === 'section' && (
                  <ol>
                    {block.children.map((child) => (
                      <li key={child.id}>
                        <button
                          type="button"
                          aria-pressed={selectedId === child.id}
                          onClick={() => setSelectedId(child.id)}
                        >
                          {blockTitle(child)}
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${child.type} up`}
                          onClick={() => apply(moveBlock(document, child.id, -1))}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${child.type} down`}
                          onClick={() => apply(moveBlock(document, child.id, 1))}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${child.type}`}
                          onClick={() => remove(child.id)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        </aside>
        <main className="lp-page-main">
          <section className="lp-page-panel" aria-label="Preview">
            <h2>Preview ({viewport})</h2>
            <div className={`lp-page-preview lp-page-preview-${viewport}`}>
              {document.blocks.length ? (
                document.blocks.map((block) => (
                  <div key={block.id} onClick={() => setSelectedId(block.id)}>
                    {<PreviewBlock block={block} />}
                  </div>
                ))
              ) : (
                <p>Add blocks to start building.</p>
              )}
            </div>
          </section>
          <section className="lp-page-panel" aria-label="Inspector">
            <h2>Inspector</h2>
            {selected ? (
              <div className="lp-page-inspector">
                {(selected.type === 'text' ||
                  selected.type === 'heading' ||
                  selected.type === 'button') && (
                  <label>
                    Text
                    <textarea
                      aria-label="Text"
                      value={selected.text}
                      onChange={(event) => updateText('text', event.target.value)}
                    />
                  </label>
                )}
                {selected.type === 'heading' && (
                  <label>
                    Heading level
                    <select
                      aria-label="Heading level"
                      value={selected.level}
                      onChange={(event) =>
                        alter({ level: Number(event.target.value) as 1 | 2 | 3 })
                      }
                    >
                      <option value="1">H1</option>
                      <option value="2">H2</option>
                      <option value="3">H3</option>
                    </select>
                  </label>
                )}
                {selected.type === 'image' && (
                  <>
                    <label>
                      Image URL
                      <input
                        aria-label="Image URL"
                        value={selected.src}
                        onChange={(event) => updateText('src', event.target.value)}
                      />
                    </label>
                    <label>
                      Alt text
                      <input
                        aria-label="Alt text"
                        value={selected.alt}
                        onChange={(event) => updateText('alt', event.target.value)}
                      />
                    </label>
                  </>
                )}
                {selected.type === 'button' && (
                  <label>
                    Link URL
                    <input
                      aria-label="Link URL"
                      value={selected.href}
                      onChange={(event) => updateText('href', event.target.value)}
                    />
                  </label>
                )}
                {selected.type === 'spacer' && (
                  <label>
                    Height (px)
                    <input
                      aria-label="Height (px)"
                      type="number"
                      min="0"
                      max="1000"
                      value={selected.height}
                      onChange={(event) => alter({ height: Number(event.target.value) })}
                    />
                  </label>
                )}
                <label>
                  Text color
                  <input
                    aria-label="Text color"
                    value={selected.style?.color ?? ''}
                    onChange={(event) => alterStyle('color', event.target.value)}
                    placeholder="#222222"
                  />
                </label>
                <label>
                  Background color
                  <input
                    aria-label="Background color"
                    value={selected.style?.backgroundColor ?? ''}
                    onChange={(event) => alterStyle('backgroundColor', event.target.value)}
                    placeholder="#ffffff"
                  />
                </label>
                <label>
                  Padding (px)
                  <input
                    aria-label="Padding (px)"
                    type="number"
                    min="0"
                    max="200"
                    value={selected.style?.padding ?? 0}
                    onChange={(event) => alterStyle('padding', event.target.value)}
                  />
                </label>
                <label>
                  Text alignment
                  <select
                    aria-label="Text alignment"
                    value={selected.style?.textAlign ?? 'left'}
                    onChange={(event) => alterStyle('textAlign', event.target.value)}
                  >
                    <option>left</option>
                    <option>center</option>
                    <option>right</option>
                  </select>
                </label>
                <label>
                  Font size (px)
                  <input
                    aria-label="Font size (px)"
                    type="number"
                    min="8"
                    max="96"
                    value={selected.style?.fontSize ?? 16}
                    onChange={(event) => alterStyle('fontSize', event.target.value)}
                  />
                </label>
              </div>
            ) : (
              <p>Select a block to edit it.</p>
            )}
          </section>
          <section className="lp-page-panel" aria-label="JSON output">
            <h2>JSON</h2>
            <p>{issues.length ? `${issues.length} validation issue(s)` : 'Document is valid'}</p>
            {issues.map((issue, index) => (
              <p role="alert" key={`${issue.path}-${index}`}>
                {issue.path}: {issue.message}
              </p>
            ))}
            <textarea
              aria-label="JSON output"
              readOnly
              value={(() => {
                try {
                  return serializePageDocument(document);
                } catch {
                  return JSON.stringify(document, null, 2);
                }
              })()}
            />
          </section>
          <section className="lp-page-panel" aria-label="HTML export">
            <h2>HTML export</h2>
            <textarea aria-label="HTML export" readOnly value={html} />
          </section>
        </main>
      </div>
    </div>
  );
}
