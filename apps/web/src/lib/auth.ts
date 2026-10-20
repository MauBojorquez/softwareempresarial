import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/server/db";

/** A not-yet-accepted, unexpired invitation for this email, if any. */
async function pendingInvitation(email: string) {
  return db.invitation.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" }, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
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
    // Records a login event for team usage analytics (fire-and-forget).
    async signIn({ user }) {
      if (!user?.id) return;
      try {
        const m = await db.membership.findFirst({ where: { userId: user.id } });
        if (!m) return;
        const { logActivity } = await import("@/lib/activity");
        await logActivity({ userId: user.id, organizationId: m.organizationId, action: "login" });
      } catch {
        // ignore
      }
    },
    // Internal tool: a brand-new user (first Google sign-in) can only exist if
    // signIn() below found a pending invitation for their email. Join them to
    // that organization with the invited role/puesto — never create a new org.
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      const existing = await db.membership.findFirst({ where: { userId: user.id } });
      if (existing) return;
      const invitation = await pendingInvitation(user.email);
      if (!invitation) return;
      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
          allowedSections: invitation.allowedSections,
          jobRole: invitation.jobRole,
        },
      });
      await db.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    },
  },
  callbacks: {
    // Closed sign-up: only existing team members, or people with a pending
    // invitation, may sign in (Google included). Everyone else is turned away
    // to /login?error=AccessDenied.
    async signIn({ user }) {
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;
      const existing = await db.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { memberships: { select: { id: true }, take: 1 } },
      });
      if (existing && existing.memberships.length > 0) return true;
      return !!(await pendingInvitation(email));
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as string) ?? "VIEWER";
        session.user.organizationId = (token.organizationId as string) ?? "";
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      // Load role + org into the token whenever they're missing — this covers
      // both fresh logins and existing sessions whose token predates this field.
      if (token.sub && token.role === undefined) {
        const m = await db.membership.findFirst({ where: { userId: token.sub } });
        token.role = m?.role ?? null;
        token.organizationId = m?.organizationId ?? null;
      }
      return token;
    },
  },
};
