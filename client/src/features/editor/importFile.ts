export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type Imported = { text: string; truncated: boolean; note?: string };

const ext = (name: string) => name.slice(name.lastIndexOf('.')).toLowerCase();

export const IMPORT_TIMEOUT_MS = 15_000;
export const MAX_PDF_PAGES = 200;

async function readDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
}

async function readPdf(file: File, limit: number): Promise<{ text: string; capped: boolean }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    disableFontFace: true,
    useSystemFonts: false,
  });
  const read = async () => {
    const doc = await task.promise;
    const pages: string[] = [];
    let length = 0;
    const last = Math.min(doc.numPages, MAX_PDF_PAGES);
    for (let n = 1; n <= last && length <= limit; n++) {
      const { items } = await (await doc.getPage(n)).getTextContent();
      const page = items.map((i) => ('str' in i ? i.str : '')).join(' ');
      pages.push(page);
      length += page.length + 2;
    }
    return { text: pages.join('\n\n'), capped: doc.numPages > MAX_PDF_PAGES && length <= limit };
  };
  try {
    return await withTimeout(read());
  } finally {
    void task.destroy(); // on timeout this stops the worker; the abandoned read then rejects, unobserved
  }
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), IMPORT_TIMEOUT_MS);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/** Extracts a file's text in the browser; the file itself never leaves it. Rejects with a student-readable message. */
export async function importFile(file: File, limit: number): Promise<Imported> {
  const type = ext(file.name);
  if (type === '.pptx') throw new Error('PowerPoint files are not supported yet. Paste the text instead.');
  if (!['.txt', '.md', '.docx', '.pdf'].includes(type)) throw new Error('Use a .txt, .md, .docx or .pdf file.');
  if (file.size > MAX_IMPORT_BYTES) throw new Error('This file is over 5 MB. Use a smaller file.');
  let text: string;
  let capped = false;
  try {
    if (type === '.pdf') ({ text, capped } = await readPdf(file, limit));
    else text = await withTimeout(type === '.docx' ? readDocx(file) : file.text());
  } catch {
    throw new Error("Couldn't read this file. Paste the text instead.");
  }
  text = text.trim();
  if (!text) throw new Error('No text found in this file.');
  const truncated = text.length > limit || capped;
  return {
    text: text.slice(0, limit),
    truncated,
    ...(capped && { note: `Only the first ${MAX_PDF_PAGES} pages were imported, so the text was cut to fit.` }),
  };
}
