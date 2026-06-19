import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/server/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Allow Google sign-in even if an account with the same email already
      // exists from email/password registration.
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user?.passwordHash) return null;
        // In production, use bcrypt.compare
        const { compare } = await import("bcryptjs");
        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  events: {
    // Fires AFTER the adapter persists a brand-new user (e.g. Google OAuth sign-up).
    // At this point user.id is a real DB id, so the Organization foreign key resolves.
    async createUser({ user }) {
      if (!user.id) return;
      const existing = await db.membership.findFirst({ where: { userId: user.id } });
      if (existing) return;
      const org = await db.organization.create({
        data: {
          name: user.name ?? user.email ?? "Mi Empresa",
          ownerId: user.id,
          subscription: {
            create: {
              stripeCustomerId: `cus_demo_${user.id}`,
              plan: "STARTER",
              interval: "MONTHLY",
            },
          },
        },
      });
      await db.membership.create({
        data: { userId: user.id, organizationId: org.id, role: "ADMIN" },
      });
      // Send welcome email (fire and forget)
      if (user.email) {
        const { sendEmail, welcomeEmail } = await import("@/server/services/email");
        const { subject, html } = welcomeEmail(user.name ?? "Usuario", user.email);
        sendEmail(user.email, subject, html).catch(() => {});
      }
    },
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
};
