export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type Imported = { text: string; truncated: boolean };

const ext = (name: string) => name.slice(name.lastIndexOf('.')).toLowerCase();

async function readDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
}

async function readPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    pages.push(items.map((i) => ('str' in i ? i.str : '')).join(' '));
  }
  return pages.join('\n\n');
}

/** Extracts a file's text in the browser; the file itself never leaves it. Rejects with a student-readable message. */
export async function importFile(file: File, limit: number): Promise<Imported> {
  const type = ext(file.name);
  if (type === '.pptx') throw new Error('PowerPoint files are not supported yet. Paste the text instead.');
  if (!['.txt', '.md', '.docx', '.pdf'].includes(type)) throw new Error('Use a .txt, .md, .docx or .pdf file.');
  if (file.size > MAX_IMPORT_BYTES) throw new Error('This file is over 5 MB. Use a smaller file.');
  let text: string;
  try {
    text = type === '.docx' ? await readDocx(file) : type === '.pdf' ? await readPdf(file) : await file.text();
  } catch {
    throw new Error("Couldn't read this file. Paste the text instead.");
  }
  text = text.trim();
  if (!text) throw new Error('No text found in this file.');
  return { text: text.slice(0, limit), truncated: text.length > limit };
}
