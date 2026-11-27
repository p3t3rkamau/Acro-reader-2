# AcroReader Prisma setup

This milestone introduces the initial database model only. It does not connect to Neon, create migrations, or modify any database.

## Reference pattern

The vCard project uses Prisma 7, `@prisma/adapter-neon`, a generated client in `src/generated/prisma`, and a singleton using `DATABASE_URL`. AcroReader will follow that approach while retaining its own database and schema.

## Required environment variables (not committed)

```env
# Pooled Neon connection for application runtime
DATABASE_URL="postgresql://...-pooler.../acroreader?sslmode=require"

# Direct Neon connection for Prisma CLI migrations
DIRECT_URL="postgresql://.../acroreader?sslmode=require"
```

Use the dedicated AcroReader Neon database. Never point these values at the vCard database. Keep both values server-only; do not use a `NEXT_PUBLIC_` prefix.

## Current status

- Initial Prisma 7 schema added for users, Auth.js adapter tables, organisations, memberships, aircraft entitlements, document categories, documents, revisions and document-level grants.
- Prisma CLI config uses `DIRECT_URL`; runtime adapter will use `DATABASE_URL`.
- No dependencies have been installed and no lockfile has been regenerated yet.
- No Prisma client generated, migration created or database contacted.
- Do not run `prisma migrate reset`, `db push`, or migrations against production during this setup.

## Next

1. Add pinned Prisma 7 packages and regenerate the npm lockfile together.
2. Generate the Prisma client and run schema validation locally.
3. Review a baseline migration against a dedicated empty/staging AcroReader database.
4. Implement the database-backed catalogue service while preserving `LibraryFolder` and `LibraryDocument`.
