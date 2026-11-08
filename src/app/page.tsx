import DocumentLibrary from '@/components/library/DocumentLibrary';
import { getDocumentLibrary } from '@/lib/server/getDocumentLibrary';

export default async function HomePage() {
  const library = await getDocumentLibrary();
  return <DocumentLibrary library={library} />;
}
