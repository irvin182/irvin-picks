import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

const handler = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },

  providers: [
    CredentialsProvider({
      name: "Irvin Analytics Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");

        if (!email || !password) return null;

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        if (!adminEmail || !adminPasswordHash) {
          throw new Error("Admin credentials not configured");
        }

        const isAdminEmail = email === adminEmail.toLowerCase();
        const isValidPassword = await bcrypt.compare(password, adminPasswordHash);

        if (!isAdminEmail || !isValidPassword) {
          return null;
        }

        return {
          id: "admin",
          name: "Irvin Admin",
          email,
          role: "ADMIN",
          plan: "admin",
          active: true,
          blocked: false,
          expires_at: null,
          sessionId: crypto.randomUUID(),
        } as any;
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.plan = (user as any).plan;
        token.active = (user as any).active;
        token.blocked = (user as any).blocked;
        token.expires_at = (user as any).expires_at;
        token.sessionId = (user as any).sessionId;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).plan = token.plan;
        (session.user as any).active = token.active;
        (session.user as any).blocked = token.blocked;
        (session.user as any).expires_at = token.expires_at;
        (session.user as any).sessionId = token.sessionId;
      }

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };