import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vite-plus/test';
import { importFile, MAX_IMPORT_BYTES } from './importFile';

vi.mock('mammoth', () => ({ extractRawText: async () => ({ value: '  Docx body  ' }) }));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: async (n: number) => ({ getTextContent: async () => ({ items: [{ str: `Page` }, { str: `${n}` }] }) }),
    }),
  }),
}));

const file = (name: string, body: BlobPart = 'x') => new File([body], name);

describe('importFile (R28)', () => {
  it('AI-TC41: .txt, .md, .docx and .pdf each give their text', async () => {
    expect((await importFile(file('a.txt', 'plain'), 100)).text).toBe('plain');
    expect((await importFile(file('a.MD', '# head'), 100)).text).toBe('# head');
    expect((await importFile(file('a.docx'), 100)).text).toBe('Docx body');
    expect((await importFile(file('a.pdf'), 100)).text).toBe('Page 1\n\nPage 2');
  });

  it('AI-TC42: a file over 5 MB is refused with a message', async () => {
    const big = file('a.txt');
    Object.defineProperty(big, 'size', { value: MAX_IMPORT_BYTES + 1 });
    await expect(importFile(big, 100)).rejects.toThrow('over 5 MB');
  });

  it('AI-TC43: .pptx and unknown types are refused', async () => {
    await expect(importFile(file('a.pptx'), 100)).rejects.toThrow('PowerPoint');
    await expect(importFile(file('a.exe'), 100)).rejects.toThrow('Use a .txt');
  });

  it('AI-TC44: the readers are imported only inside the functions', () => {
    const src = readFileSync(new URL('./importFile.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/^import .*(mammoth|pdfjs-dist)/m);
    expect(src).toContain("await import('mammoth')");
    expect(src).toContain("await import('pdfjs-dist')");
    for (const f of ['DraftFromText.tsx', 'FileImport.tsx'])
      expect(readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')).not.toMatch(/(mammoth|pdfjs-dist)/);
  });

  it('AI-TC45: text over the limit is cut and flagged', async () => {
    expect(await importFile(file('a.txt', 'abcdef'), 4)).toEqual({ text: 'abcd', truncated: true });
    expect((await importFile(file('a.txt', 'abcd'), 4)).truncated).toBe(false);
  });
});
