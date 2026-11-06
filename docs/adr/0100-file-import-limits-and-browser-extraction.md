# 0100 - File import limits and browser-side extraction (R28, #115, 7 Nov 2026)

- **Context:** "Draft slides from text" gains a file import (.txt, .md, .docx, .pdf). Reading untrusted files needs
  bounds, and the privacy promise is that a file never leaves the device.
- **Decision:** extract in the browser with mammoth and pdf.js, loaded lazily; no upload, only the extracted text is
  sent when the user presses Send. Limits: 5 MB per file, 200 PDF pages, a 15 s read timeout (a PDF timeout also
  destroys the pdf.js task). The pdf.js worker is bundled locally with `new URL(...)`, same origin, no CDN. File types
  are checked by extension only, because `file.type` is derived from the extension anyway. The .pptx type is refused
  with a message. The .docx zip-bomb guard (capping the unzipped size) is deferred: it needs the jszip dependency and
  the owner has not decided; the 5 MB cap and the timeout bound it for now.
- **Alternatives:** server-side parsing (an upload endpoint and a new attack surface), the pdf.js CDN worker (an
  external dependency), content sniffing (no gain over the extension).
- **Reversibility:** High; client-only, the limits are constants in `importFile.ts`.
- **Tests:** AI-TC41-45.
