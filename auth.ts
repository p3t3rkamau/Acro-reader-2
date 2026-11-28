import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import argon2 from 'argon2';
import { z } from 'zod';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  pages: {
    signIn: '/admin/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 12 * 60 * 60,
  },
  providers: [
    Credentials({
      name: 'AcroReader administrator',
      credentials: {
        email: { label: 'Administrator email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const passwordHash = process.env.ADMIN_PASSWORD_HASH_B64
          ? Buffer.from(process.env.ADMIN_PASSWORD_HASH_B64, 'base64').toString('utf8')
          : undefined;

        if (!parsed.success || !configuredEmail || !passwordHash) return null;
        if (!passwordHash.startsWith('$argon2id$')) return null;
        if (parsed.data.email.toLowerCase() !== configuredEmail) return null;

        try {
          const valid = await argon2.verify(passwordHash, parsed.data.password);
          if (!valid) return null;
        } catch {
          return null;
        }

        return {
          id: 'acroreader-admin',
          name: 'AcroReader Administrator',
          email: configuredEmail,
          role: 'ADMIN' as const,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.role) token.role = user.role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.role = token.role;
      return session;
    },
  },
});
