import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

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

        if (email === "irvinzc@gmail.com" && password === "123456") {
          return {
            id: "admin",
            name: "Irvin Admin",
            email,
            role: "ADMIN",
            plan: "admin",
            sessionId: "emergency-admin-session",
          } as any;
        }

        return null;
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
        token.sessionId = (user as any).sessionId;
        token.blocked = false;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).plan = token.plan;
        (session.user as any).sessionId = token.sessionId;
        (session.user as any).blocked = false;
      }

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };