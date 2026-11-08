const PDF_MAGIC = '%PDF-';

export interface ValidationResult { ok: boolean; message?: string }

/** Cheap pre-flight check: extension/MIME plus the "%PDF-" header within the first 1 KB. */
export async function validatePDFFile(file: File): Promise<ValidationResult> {
  if (file.size === 0) return { ok: false, message: 'This file is empty.' };
  const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const head = new TextDecoder('latin1').decode(await file.slice(0, 1024).arrayBuffer());
  if (!head.includes(PDF_MAGIC)) {
    return {
      ok: false,
      message: looksLikePdf
        ? 'This file has a .pdf name but is not a valid PDF. It may be damaged or incomplete.'
        : 'This is not a PDF file. Choose a file ending in .pdf.',
    };
  }
  return { ok: true };
}

/** Only http(s) URLs are accepted. */
export function parsePDFUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}
