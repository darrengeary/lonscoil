// app/api/auth/[...nextauth]/route.ts

import authConfig from "@/auth.config";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@prisma/client";
import NextAuth, { type DefaultSession } from "next-auth";
import { prisma } from "@/lib/db";

// IMPORTANT: make sure this env var is set in your .env.local:
//    NEXTAUTH_SECRET=some-long-random-string

// Augment the session object to include `role`
declare module "next-auth" {
  interface Session {
    user: {
      role: UserRole;
    } & DefaultSession["user"];
  }
}

export const {
  handlers: { GET, POST },
  auth,
} = NextAuth({
  adapter: PrismaAdapter(prisma),

  // Use JWTs for session
  session: { strategy: "jwt" },

  // 🔑 Tell NextAuth which secret to use when signing/verifying JWTs
  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: "/login",
    // error: "/auth/error",
  },

  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, persist the role
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ token, session }) {
      // Expose the role (and other standard fields) on the session
      session.user.id    = token.sub!;
      session.user.email = token.email!;
      session.user.name  = token.name!;
      session.user.image = token.picture!;
      session.user.role  = token.role!;
      return session;
    },
  },

  // Finally, spread in whatever is in your auth.config (providers, etc)
  ...authConfig,

  // debug: process.env.NODE_ENV !== "production",
});