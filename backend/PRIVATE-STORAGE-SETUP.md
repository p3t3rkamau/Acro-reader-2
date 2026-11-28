# AcroReader private Blob storage setup

The public catalogue remains accessible without signing in. Opening a PDF requires an active, administrator-provisioned AcroReader viewer account.

## Create the private store

1. Open the AcroReader project in the Vercel dashboard.
2. Open **Storage** and create a new **Blob** store.
3. Set the store access to **Private**. Do not reuse the existing public store.
4. Connect the private store to the AcroReader Vercel project.
5. Copy the private store's read-write token into the server environment variable `ACRO_PRIVATE_READ_WRITE_TOKEN`.
6. Add the same variable to your local `.env` file.
7. Keep the existing `ACRO_READ_WRITE_TOKEN` configured. It is needed temporarily to read and, after private copies are verified, delete old public objects.

Example variable names (never commit token values):

```env
ACRO_READ_WRITE_TOKEN=your_existing_public_store_token
ACRO_PRIVATE_READ_WRITE_TOKEN=your_new_private_store_token
```

Configure both variables for the required Vercel environments (Development, Preview and Production as appropriate). Restart the local Next.js server after changing `.env`.

## How the application uses the stores

- New uploads use the private store and are marked `PRIVATE` in Neon.
- The public catalogue contains only same-origin reader URLs, never direct Blob URLs.
- The PDF endpoint requires an authorised viewer session and forwards HTTP Range requests to Blob.
- Existing public revisions are listed on **Admin → Private PDF storage**.
- The migration copies one PDF at a time as a stream, verifies the private copy's path, content type and size, then updates Neon.
- The old public object is deliberately not deleted during the copy operation. After checking the private copy, the administrator can explicitly delete the old public object from the same page.
- Do not remove the public token until every legacy public copy has been deleted and verified.

## Important

A private Blob store protects the file URL itself. The application still has to authorise each viewer request; a valid Blob token is not an end-user permission. The reader route checks the viewer's active account on every request.

Removing the download control and using `Content-Disposition: inline` discourages casual downloading, but cannot stop an authorised viewer from capturing bytes that their browser has received (for example through developer tools, a network proxy or screenshots). Do not describe browser-based PDF viewing as DRM or absolute download prevention.
