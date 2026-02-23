
import type { NextAuthConfig, DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import ResendProvider from "next-auth/providers/resend";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { env } from "@/env.mjs";
import { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      schoolId?: string;
    } & DefaultSession["user"];
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    schoolId?: string;
  }
}

const authConfig: NextAuthConfig = {
  providers: [
    // Password login (future logins)
    CredentialsProvider({
      name: "Email+Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          !credentials ||
          typeof credentials.email !== "string" ||
          typeof credentials.password !== "string"
        ) return null;

        const email = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.hashedPassword) return null;

        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) return null;

        // Keep this if you want email verified before password login:
        // (This matches your “verify on register” behavior.)
        if (!user.emailVerified) return null;

        return {
          id: user.id,
          name: user.name ?? undefined,
          email: user.email ?? undefined,
          image: user.image ?? undefined,
          role: user.role,
          schoolId: user.schoolId ?? undefined,
        };
      },
    }),

    // Keep Resend ONLY for the registration verification link flow
    ResendProvider({
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
    }),
  ],

  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
    verifyRequest: "/register/verify-request",
    newUser: "/parent/pupils",
  },

  callbacks: {
    async redirect({ url, baseUrl }) {
      return url.startsWith(baseUrl) ? url : baseUrl;
    },

    async jwt({ token }) {
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.sub } });
        if (dbUser) {
          token.name = dbUser.name ?? undefined;
          token.email = dbUser.email ?? undefined;
          token.picture = dbUser.image ?? undefined;
          token.role = dbUser.role;
          token.schoolId = dbUser.schoolId ?? undefined;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.email = token.email!;
        session.user.name = token.name!;
        session.user.image = token.picture as any;
        session.user.role = token.role!;
        session.user.schoolId = token.schoolId;
      }
      return session;
    },
  },
};

export default authConfig;
