import { PageBuilder, renderPageHtml, type PageDocument } from '@lp-labs/react-page-builder';

const page: PageDocument = { version: 1, blocks: [{ id: 'x', type: 'text', text: 'ok' }] };
void PageBuilder;
void renderPageHtml(page);
