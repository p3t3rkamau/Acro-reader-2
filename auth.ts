import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200),
  intent: z.enum(['admin', 'viewer']).default('admin'),
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
      name: 'AcroReader account',
      credentials: {
        email: { label: 'Email address', type: 'email' },
        password: { label: 'Password', type: 'password' },
        intent: { label: 'Account type', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, intent } = parsed.data;
        const normalizedEmail = email.toLowerCase();

        if (intent === 'admin') {
          const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
          const passwordHash = process.env.ADMIN_PASSWORD_HASH_B64
            ? Buffer.from(process.env.ADMIN_PASSWORD_HASH_B64, 'base64').toString('utf8')
            : undefined;

          if (!configuredEmail || !passwordHash || !passwordHash.startsWith('$argon2id$')) return null;
          if (normalizedEmail !== configuredEmail) return null;

          try {
            if (!await argon2.verify(passwordHash, password)) return null;
          } catch {
            return null;
          }

          return {
            id: 'acroreader-admin',
            name: 'AcroReader Administrator',
            email: configuredEmail,
            role: 'ADMIN' as const,
          };
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            emailVerified: true,
            status: true,
          },
        });

        if (
          !user ||
          user.status !== 'ACTIVE' ||
          !user.emailVerified ||
          !user.passwordHash ||
          !user.passwordHash.startsWith('$argon2id$')
        ) {
          return null;
        }

        try {
          if (!await argon2.verify(user.passwordHash, password)) return null;
        } catch {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'VIEWER' as const,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        if (user.role) token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.role = token.role === 'ADMIN' || token.role === 'VIEWER'
          ? token.role
          : undefined;
      }
      return session;
    },
  },
});
