export type TextAlign = 'left' | 'center' | 'right';

export interface BlockStyle {
  color?: string;
  backgroundColor?: string;
  padding?: number;
  textAlign?: TextAlign;
  fontSize?: number;
}

export interface SectionBlock {
  id: string;
  type: 'section';
  children: PageContentBlock[];
  style?: BlockStyle;
}

export interface TextBlock {
  id: string;
  type: 'text';
  text: string;
  style?: BlockStyle;
}

export interface HeadingBlock {
  id: string;
  type: 'heading';
  text: string;
  level: 1 | 2 | 3;
  style?: BlockStyle;
}

export interface ImageBlock {
  id: string;
  type: 'image';
  src: string;
  alt: string;
  style?: BlockStyle;
}

export interface ButtonBlock {
  id: string;
  type: 'button';
  text: string;
  href: string;
  style?: BlockStyle;
}

export interface SpacerBlock {
  id: string;
  type: 'spacer';
  height: number;
  style?: BlockStyle;
}

export type PageContentBlock = TextBlock | HeadingBlock | ImageBlock | ButtonBlock | SpacerBlock;
export type PageBlock = SectionBlock | PageContentBlock;
export interface PageDocument {
  version: 1;
  blocks: PageBlock[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return /^(https?:|mailto:|tel:)/i.test(trimmed);
  return !trimmed.startsWith('//');
}

function validStyle(value: unknown): value is BlockStyle {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  if (
    value.color !== undefined &&
    (typeof value.color !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.color))
  )
    return false;
  if (
    value.backgroundColor !== undefined &&
    (typeof value.backgroundColor !== 'string' ||
      !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.backgroundColor))
  )
    return false;
  if (
    value.padding !== undefined &&
    (typeof value.padding !== 'number' ||
      !Number.isFinite(value.padding) ||
      value.padding < 0 ||
      value.padding > 200)
  )
    return false;
  if (
    value.fontSize !== undefined &&
    (typeof value.fontSize !== 'number' ||
      !Number.isFinite(value.fontSize) ||
      value.fontSize < 8 ||
      value.fontSize > 96)
  )
    return false;
  return (
    value.textAlign === undefined ||
    value.textAlign === 'left' ||
    value.textAlign === 'center' ||
    value.textAlign === 'right'
  );
}

function validateBlock(
  block: unknown,
  path: string,
  issues: ValidationIssue[],
  ids: Set<string>,
  nested = false,
): void {
  if (!isRecord(block)) {
    issues.push({ path, message: 'Expected a block object.' });
    return;
  }
  if (typeof block.id !== 'string' || !block.id.trim())
    issues.push({ path: `${path}.id`, message: 'A non-empty id is required.' });
  else if (ids.has(block.id))
    issues.push({ path: `${path}.id`, message: 'Block ids must be unique.' });
  else ids.add(block.id);
  if (!validStyle(block.style))
    issues.push({
      path: `${path}.style`,
      message: 'Style contains unsupported or out-of-range values.',
    });
  const text = (key: string) => {
    if (typeof block[key] !== 'string')
      issues.push({ path: `${path}.${key}`, message: 'Expected text.' });
  };
  switch (block.type) {
    case 'section':
      if (nested) issues.push({ path, message: 'Sections cannot be nested.' });
      if (!Array.isArray(block.children))
        issues.push({ path: `${path}.children`, message: 'Expected an array of content blocks.' });
      else
        block.children.forEach((child, index) =>
          validateBlock(child, `${path}.children[${index}]`, issues, ids, true),
        );
      break;
    case 'text':
      text('text');
      break;
    case 'heading':
      text('text');
      if (block.level !== 1 && block.level !== 2 && block.level !== 3)
        issues.push({ path: `${path}.level`, message: 'Heading level must be 1, 2, or 3.' });
      break;
    case 'image':
      text('src');
      text('alt');
      if (typeof block.src === 'string' && !isSafeUrl(block.src))
        issues.push({
          path: `${path}.src`,
          message: 'Image URL uses an unsupported or unsafe scheme.',
        });
      break;
    case 'button':
      text('text');
      text('href');
      if (typeof block.href === 'string' && !isSafeUrl(block.href))
        issues.push({
          path: `${path}.href`,
          message: 'Link URL uses an unsupported or unsafe scheme.',
        });
      break;
    case 'spacer':
      if (
        typeof block.height !== 'number' ||
        !Number.isFinite(block.height) ||
        block.height < 0 ||
        block.height > 1000
      )
        issues.push({
          path: `${path}.height`,
          message: 'Spacer height must be between 0 and 1000 pixels.',
        });
      break;
    default:
      issues.push({ path: `${path}.type`, message: 'Unsupported block type.' });
  }
}

export function validatePageDocument(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.blocks)) {
    return [{ path: '$', message: 'Expected a version 1 page document with a blocks array.' }];
  }
  const ids = new Set<string>();
  value.blocks.forEach((block, index) => validateBlock(block, `$.blocks[${index}]`, issues, ids));
  return issues;
}

export function parsePageDocument(json: string): PageDocument {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    throw new Error('Page JSON is not valid JSON.');
  }
  const issues = validatePageDocument(value);
  if (issues.length)
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  return value as PageDocument;
}

export function serializePageDocument(document: PageDocument): string {
  const issues = validatePageDocument(document);
  if (issues.length)
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  return JSON.stringify(document, null, 2);
}
