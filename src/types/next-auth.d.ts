import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role?: 'ADMIN' | 'VIEWER';
    } & DefaultSession['user'];
  }

  interface User {
    role?: 'ADMIN' | 'VIEWER';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'ADMIN' | 'VIEWER';
  }
}
