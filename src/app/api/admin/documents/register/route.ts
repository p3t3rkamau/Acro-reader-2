import { NextResponse } from 'next/server';
import { auth } from '../../../../../../auth';
import { registerPublicDocument } from '@/lib/server/registerPublicDocument';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await auth();

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 401 });
  }

  try {
    const input: unknown = await request.json();
    const revision = await registerPublicDocument(input);

    return NextResponse.json(
      { success: true, revisionId: revision.id },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save the uploaded document.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
