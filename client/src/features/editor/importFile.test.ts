import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { importFile, IMPORT_TIMEOUT_MS, MAX_IMPORT_BYTES, MAX_PDF_PAGES } from './importFile';

const m = vi.hoisted(() => ({
  loaded: [] as string[],
  numPages: 2,
  pagesRead: 0,
  hang: false,
  destroy: undefined as unknown as () => Promise<void>,
}));
m.destroy = vi.fn(async () => {});

vi.mock('mammoth', () => {
  m.loaded.push('mammoth');
  return { extractRawText: async () => ({ value: '  Docx body  ' }) };
});
vi.mock('pdfjs-dist', () => {
  m.loaded.push('pdfjs-dist');
  return {
    GlobalWorkerOptions: {},
    getDocument: () => ({
      destroy: m.destroy,
      promise: m.hang
        ? new Promise(() => {})
        : Promise.resolve({
            numPages: m.numPages,
            getPage: async (n: number) => {
              m.pagesRead++;
              return { getTextContent: async () => ({ items: [{ str: 'Page' }, { str: `${n}` }] }) };
            },
          }),
    }),
  };
});

afterEach(() => {
  m.numPages = 2;
  m.pagesRead = 0;
  m.hang = false;
  vi.useRealTimers();
});

const file = (name: string, body: BlobPart = 'x') => new File([body], name);

describe('importFile (R28)', () => {
  // First on purpose: the mock factories run on first load, so nothing may import a reader before this.
  it('AI-TC44: mammoth and pdfjs-dist load only when a .docx or .pdf is imported', async () => {
    expect(m.loaded).toEqual([]);
    await importFile(file('a.txt', 'plain'), 100);
    expect(m.loaded).toEqual([]);
    await importFile(file('a.docx'), 100);
    expect(m.loaded).toEqual(['mammoth']);
    await importFile(file('a.pdf'), 100);
    expect(m.loaded).toEqual(['mammoth', 'pdfjs-dist']);
    // Supplement: no static import in the editor sources.
    expect(readFileSync(new URL('./importFile.ts', import.meta.url), 'utf8')).not.toMatch(
      /^import .*(mammoth|pdfjs-dist)/m,
    );
    for (const f of ['DraftFromText.tsx', 'FileImport.tsx'])
      expect(readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')).not.toMatch(/(mammoth|pdfjs-dist)/);
  });

  it('AI-TC41: .txt, .md, .docx and .pdf each give their text', async () => {
    expect((await importFile(file('a.txt', 'plain'), 100)).text).toBe('plain');
    expect((await importFile(file('a.MD', '# head'), 100)).text).toBe('# head');
    expect((await importFile(file('a.docx'), 100)).text).toBe('Docx body');
    expect((await importFile(file('a.pdf'), 100)).text).toBe('Page 1\n\nPage 2');
  });

  it('AI-TC42: a file over 5 MB is refused with a message', async () => {
    const big = file('a.txt');
    Object.defineProperty(big, 'size', { value: MAX_IMPORT_BYTES + 1 });
    const read = vi.spyOn(big, 'text');
    const buf = vi.spyOn(big, 'arrayBuffer');
    await expect(importFile(big, 100)).rejects.toThrow('over 5 MB');
    expect(read).not.toHaveBeenCalled();
    expect(buf).not.toHaveBeenCalled();
  });

  it('AI-TC43: .pptx and unknown types are refused', async () => {
    await expect(importFile(file('a.pptx'), 100)).rejects.toThrow('PowerPoint');
    await expect(importFile(file('a.exe'), 100)).rejects.toThrow('Use a .txt');
  });

  it('AI-TC45: a PDF stops at the page cap or the limit, and a stuck read times out', async () => {
    m.numPages = 500;
    const capped = await importFile(file('a.pdf'), 1_000_000);
    expect(m.pagesRead).toBe(MAX_PDF_PAGES);
    expect(capped.note).toContain('first 200 pages');
    expect(capped.truncated).toBe(true);
    m.pagesRead = 0;
    expect((await importFile(file('a.pdf'), 10)).truncated).toBe(true);
    expect(m.pagesRead).toBeLessThan(5);
    expect(m.destroy).toHaveBeenCalled();

    m.hang = true;
    vi.useFakeTimers();
    const stuck = importFile(file('a.pdf'), 100);
    const assertion = expect(stuck).rejects.toThrow("Couldn't read this file");
    await vi.advanceTimersByTimeAsync(IMPORT_TIMEOUT_MS);
    await assertion;
  });

  it('AI-TC45: text over the limit is cut and flagged', async () => {
    expect(await importFile(file('a.txt', 'abcdef'), 4)).toEqual({ text: 'abcd', truncated: true });
    expect((await importFile(file('a.txt', 'abcd'), 4)).truncated).toBe(false);
  });
});
