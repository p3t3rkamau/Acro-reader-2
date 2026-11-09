import type { Metadata, Viewport } from 'next';
import './globals.scss';

export const metadata: Metadata = {
  title: 'AcroReader | Aviation Document Portal',
  description: 'Browse aviation manuals and read interactive PDF documents on desktop, tablet and mobile.',
};

// viewport-fit=cover lets us use the full screen on notched phones (we add safe-area padding).
// Pinch-zoom is handled by the reader itself, so the browser's page zoom is disabled.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* PDF.js viewer styles (text layer, annotation layer, page loading icon). */}
        <link rel="stylesheet" href="/pdfjs/pdf_viewer.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
