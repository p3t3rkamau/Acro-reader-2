# AcroReader Prisma and Neon database

## Connection configuration

The application uses Prisma 7 with `@prisma/adapter-neon`.

- `DATABASE_URL`: pooled Neon connection used by the Next.js runtime.
- `DIRECT_URL`: direct Neon connection used by Prisma CLI migrations.
- Both URLs must point to the dedicated AcroReader Neon database, not the vCard database.
- Keep both values server-only. Never use a `NEXT_PUBLIC_` prefix or commit real credentials.

## Current status

- Prisma 7 packages are installed and pinned in `package.json`.
- The generated Prisma client is written to `src/generated/prisma`.
- The runtime Prisma singleton uses `DATABASE_URL`.
- The database health endpoint is available at `/api/health/db`.
- The initial migration `20261128000000_initial_acroreader` has been applied successfully to the dedicated `Designer Hub` Neon database.
- `npx prisma migrate status` reports that the database schema is up to date.
- The server-rendered catalogue now reads documents, categories and published/superseded revisions through Prisma while preserving the existing `LibraryFolder` contract.
- Payload is no longer used as a live catalogue data source. The app package does not include a Payload SDK.
- The starter category seed is in `prisma/seed-categories.sql`. It is idempotent and only inserts/updates the six shared catalogue categories.

## Initialize the starter categories

After pulling the latest feature branch, run:

```bash
npx prisma db execute --file prisma/seed-categories.sql
```

This creates or updates the shared `Flight Operations`, `Maintenance`, `AFM`, `QRH`, `AOM` and `Checklists` categories. It does not create aircraft documents, revisions, users or organisations.

The category tree is shared across aircraft series. Each document stores its aircraft series separately, so the same category hierarchy can be used by DASH 100, 200, 300 and 400.

## Safety rules

- Never run `prisma migrate reset` against this database.
- Do not use `prisma db push` as a substitute for reviewed migrations.
- Use additive, reviewed migrations for future schema changes.
- Never apply a production migration without a verified backup, staging test and explicit approval.
