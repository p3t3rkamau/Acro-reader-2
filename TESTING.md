# Testing record

Tested in headless Chromium (Playwright, desktop 1280×800 and emulated phone 390×844 with touch) against
`QRH_Q400_easyRecovered.pdf` (194 pages, InDesign 16.2, 3,955 GoTo links, 9 top-level bookmarks) plus generated files.

## Verified
| Check | Result |
|---|---|
| Open local file (chunked reads, no full copy) | Pass |
| Faithful rendering (fonts, vector shapes, tab index) | Pass (visual check) |
| Lazy rendering | Pass: 2 canvases on open; max 10 alive while scrolling 1,200 pages |
| Internal link click (desktop) / tap (touch) | Pass: page 1 → 8 |
| Previous view (Back) after a link | Pass |
| Page box: valid jump, invalid rejected | Pass |
| Bookmarks: real titles, nesting, tap navigates | Pass |
| Zoom: buttons, Ctrl+wheel, Ctrl +/−/0, double-tap, pinch in/out (CDP touch) | Pass |
| Jump to page 700 of 1,200 | Pass: 0.28 s |
| URL loading with HTTP range requests; no-range server detected | Pass |
| Errors: 404, not-a-PDF, corrupted, unreachable/CORS, fake local file | Pass (specific messages) |
| Password PDF: wrong then right password | Pass |
| Compatibility report counts vs independent pypdf count | Match (3,955 GoTo, 1 FreeText) |

## NOT verified
- Real iPhone, iPad, Android devices and real mobile Safari (emulation only; iOS pinch/double-tap behaviour needs a device).
- External URI links (the QRH has none), named destinations, form fields, nested-bookmark depth > 2.
- Windows/Firefox/Safari desktop.
- Real 1,000-page InDesign file and memory on low-end phones (synthetic text-only 1,200 pages used).
- Slow-network behaviour, rotation on a real device, tablet layout screenshots.

## Compatibility matrix
Fully verified: GoTo links. Everything else in `src/lib/pdf/pdfCompatibility.ts` is labelled "Not yet tested" in the app.
Cannot work in any PDF viewer: InDesign object animations (not exported to PDF). Not supported by PDF.js: page transitions,
movie/sound/rich-media/3D. Not executed (scripting off): PDF JavaScript.
