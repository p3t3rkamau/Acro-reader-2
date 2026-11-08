import DocumentLibrary from '@/components/library/DocumentLibrary';

export default async function LibraryPage({ params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  return <DocumentLibrary path={segments} />;
}
