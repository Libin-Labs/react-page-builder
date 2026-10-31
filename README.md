# @lp-labs/react-page-builder

Package version: `1.0.0`. Requires React `^18.2.0 || ^19.0.0`
as its only runtime peer. Named ESM and CommonJS exports include declarations;
TypeScript React consumers also need their application's React types.

A standalone React page editor with a versioned block model, live preview, JSON validation, and an escaped HTML export. It has no runtime dependency other than React.

## Install

```sh
npm install @lp-labs/react-page-builder react
```

Import its styles once in your application:

```ts
import "@lp-labs/react-page-builder/style.css";
```

## Use

```tsx
import { useState } from "react";
import { PageBuilder, type PageDocument } from "@lp-labs/react-page-builder";

const initial: PageDocument = {
  version: 1,
  blocks: [{ id: "intro", type: "section", children: [
    { id: "title", type: "heading", level: 1, text: "Welcome" },
    { id: "copy", type: "text", text: "A short introduction." }
  ] }]
};

export function Editor() {
  const [page, setPage] = useState(initial);
  return <PageBuilder value={page} onChange={setPage} />;
}
```

`PageBuilderProps` (all fields optional):

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `PageDocument` | absent | Controlled document when supplied. |
| `defaultValue` | `PageDocument` | `{ version: 1, blocks: [] }` | Initial document in uncontrolled mode. |
| `onChange` | `(document: PageDocument) => void` | absent | Called with each edit; a controlled parent must store and pass the new value back. |
| `className` | `string` | absent | Added to the editor root for customization. |

Use either `value` or `defaultValue`, not both. The UI offers a palette, outline selection, top-level and section-child reordering, removal, inspector fields, undo/redo (last 50 edit snapshots), desktop/tablet/mobile preview widths, JSON output, validation feedback, and HTML output. New non-section blocks are added to the selected section when the section itself is selected; otherwise they are added at the document root.

## Data and rendering API

- `PageDocument` is `{ version: 1; blocks: PageBlock[] }`.
- `PageBlock` is a `SectionBlock` or `TextBlock`, `HeadingBlock`, `ImageBlock`, `ButtonBlock`, or `SpacerBlock`. Sections hold `PageContentBlock[]`; nesting sections is unsupported.
- Text blocks have `text`; headings have `text` and `level` (`1 | 2 | 3`); images have `src` and `alt`; buttons have `text` and `href`; spacers have `height` in pixels.
- Every block has a unique non-empty `id`. Optional styles are limited to hex `color`/`backgroundColor`, `padding` (0-200 px), `fontSize` (8-96 px), and `textAlign` (`left`, `center`, `right`).
- `validatePageDocument(unknown)` returns `{ path, message }[]`; empty means valid. `parsePageDocument(string)` parses and validates or throws an `Error`. `serializePageDocument(PageDocument)` validates and returns indented JSON or throws. `renderPageHtml(PageDocument)` validates and returns an HTML document or throws. `escapeHtml(string)` is also exported.
- URL checks trim outer whitespace and accept `http:`, `https:`, `mailto:`, `tel:`, and non-scheme relative paths. After trimming, empty URLs, remaining control characters, protocol-relative paths, and other schemes are rejected. Text and attributes are escaped. No arbitrary HTML, script, event handlers, or raw CSS can be specified.

### Complete named exports

Runtime exports are `PageBuilder`, `validatePageDocument`, `parsePageDocument`,
`serializePageDocument`, `renderPageHtml`, `escapeHtml`, and `isSafeUrl`.
There is no default export. Type-only exports are `PageBuilderProps`, `TextAlign`,
`BlockStyle`, `SectionBlock`, `TextBlock`, `HeadingBlock`, `ImageBlock`,
`ButtonBlock`, `SpacerBlock`, `PageContentBlock`, `PageBlock`, `PageDocument`,
and `ValidationIssue`.

Every block requires `id: string` and a literal `type`, with optional
`style: BlockStyle`. Additional required fields:

| Exported variant | `type` | Additional fields |
| --- | --- | --- |
| `SectionBlock` | `"section"` | `children: PageContentBlock[]` |
| `TextBlock` | `"text"` | `text: string` |
| `HeadingBlock` | `"heading"` | `text: string`, `level: 1 \| 2 \| 3` |
| `ImageBlock` | `"image"` | `src: string`, `alt: string` |
| `ButtonBlock` | `"button"` | `text: string`, `href: string` |
| `SpacerBlock` | `"spacer"` | `height: number` (0-1000 px) |

`PageContentBlock` is the union excluding sections; `PageBlock` adds sections.
`TextAlign = "left" | "center" | "right"`. All `BlockStyle` fields are optional:
`color?: string`, `backgroundColor?: string`, `padding?: number`,
`fontSize?: number`, `textAlign?: TextAlign`; omitted fields use renderer/browser
defaults. `ValidationIssue = { path: string; message: string }`.

- `validatePageDocument(value: unknown): ValidationIssue[]` returns an empty list
  for valid input and path/message issues for ordinary malformed JSON values.
- `parsePageDocument(json: string): PageDocument` throws plain `Error` for
  malformed JSON or newline-separated validation issues.
- `serializePageDocument(document: PageDocument): string` validates and produces
  two-space-indented JSON; validation/native JSON serialization can throw.
- `renderPageHtml(document: PageDocument): string` validates and returns HTML,
  throwing `Error` on validation failure.
- `escapeHtml(value: string): string` escapes `&`, `<`, `>`, double and single
  quotes for HTML text/attributes, not arbitrary markup sanitization.
- `isSafeUrl(value: string): boolean` trims for checking and applies the policy
  above; it neither normalizes document URLs nor verifies trust, reachability,
  redirects, or asset content.

Standalone model/export example:

```ts
import {
  parsePageDocument, serializePageDocument, renderPageHtml, isSafeUrl
} from "@lp-labs/react-page-builder";

const page = parsePageDocument(JSON.stringify({
  version: 1,
  blocks: [{ id: "intro", type: "text", text: "Hello <reader>" }]
}));
console.log(serializePageDocument(page), renderPageHtml(page));
console.log(isSafeUrl("https://example.com")); // true
```

## Accessibility and limitations

Editor controls are native buttons, labels, inputs, and selects with accessible names; the preview uses semantic headings, paragraphs, links, images with editable alt text, and hidden spacer semantics. The preview is a convenient visual approximation, not a responsive browser renderer. Exported HTML is a minimal standalone document and intentionally does not promise universal production readiness, security review, SEO behavior, or exact rendering across browsers. It has no theme/layout system, arbitrary nested layout tree, drag-and-drop, rich-text editor, asset manager, or CSS breakpoint schema. Applications should validate their own data and review exported output before deployment.

Customization is available through `className` and the `lp-page-*` CSS classes; consumers may override those classes or build a separate presentation around the exported typed model. The JSON and HTML output fields are read-only; edits are performed with the block palette and inspector.

Editing/helpers are synchronous; there is no autosave, worker, cancellation, or
subscription API. Parent applications own persistence and controlled state.
`defaultValue` is initial state, not a live reset prop. History snapshots and
full-document preview/serialization retain and scan data; there is no
virtualization or throughput guarantee for large documents. Preview images may
load external URLs. Import alone starts no browser work; mount in a DOM-capable
React application with its own renderer. Editor CSS is not embedded in exported
HTML.

## Project

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
