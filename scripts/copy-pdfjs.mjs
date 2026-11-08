// Copies the PDF.js runtime (worker, viewer, CMaps, fonts, images) into /public/pdfjs.
// We load PDF.js as native ES modules from there instead of bundling it, which avoids
// known bundler issues with pdfjs-dist 4.x and keeps the worker/CMap paths predictable.
// Set PDFJS_LEGACY=1 to ship the legacy build for older browsers (e.g. iOS < 16.4).
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const root = 'node_modules/pdfjs-dist';
const legacy = process.env.PDFJS_LEGACY === '1';
const build = legacy ? `${root}/legacy/build` : `${root}/build`;
const web = legacy ? `${root}/legacy/web` : `${root}/web`;
const out = 'public/pdfjs';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(`${build}/pdf.min.mjs`, `${out}/pdf.min.mjs`);
cpSync(`${build}/pdf.worker.min.mjs`, `${out}/pdf.worker.min.mjs`);
cpSync(`${web}/pdf_viewer.mjs`, `${out}/pdf_viewer.mjs`);
cpSync(`${web}/pdf_viewer.css`, `${out}/pdf_viewer.css`);
cpSync(`${web}/images`, `${out}/images`, { recursive: true });
cpSync(`${root}/cmaps`, `${out}/cmaps`, { recursive: true });
cpSync(`${root}/standard_fonts`, `${out}/standard_fonts`, { recursive: true });
console.log(`PDF.js (${legacy ? 'legacy' : 'modern'}) copied to ${out}`);
