import { redirect } from 'next/navigation';
import PDFApp from '@/components/pdf-viewer/PDFApp';
import { getViewerSession } from '@/lib/auth/requireViewer';

type Props = {
  searchParams: Promise<{ url?: string }>;
};

export default async function ReaderPage({ searchParams }: Props) {
  const { url } = await searchParams;

  // Device-local PDFs remain available without an account. Catalogue documents
  // are served only through our authenticated same-origin endpoint.
  if (url?.includes('/api/documents/')) {
    const session = await getViewerSession();
    if (!session) redirect('/login');
  }

  return <PDFApp />;
}
