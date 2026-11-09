import DocumentLibrary from '@/components/library/DocumentLibrary';
import { getDocumentLibrary } from '@/lib/server/getDocumentLibrary';

export default async function LibraryPage({ params }: { params: Promise<{ segments: string[] }> }) {
  const [{ segments }, library] = await Promise.all([params, getDocumentLibrary()]);
  return <DocumentLibrary path={segments} library={library} />;
}
