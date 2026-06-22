import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is not configured");
}

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

        if (isAdminEmail) {
          const isValidAdminPassword = await bcrypt.compare(
            password,
            adminPasswordHash
          );

          if (!isValidAdminPassword) return null;

   return {
  id: user.id,
  name: user.name,
  email: user.email,
  role: "USER",
  plan: user.plan,
  active: true,
  blocked: false,
  expires_at: user.expires_at,
  sessionId: crypto.randomUUID(),
} as any;

        const { data: user, error } = await supabaseAdmin
          .from("app_users")
          .select(
            "id,email,name,password,plan,active,expires_at,active_session_id"
          )
          .eq("email", email)
          .maybeSingle();

        if (error) {
          console.error("Login user lookup error:", error);
          return null;
        }

        if (!user) return null;
        if (user.active === false) return null;

        if (
          user.expires_at &&
          new Date(user.expires_at).getTime() < Date.now()
        ) {
          return null;
        }

        // DEBUG TEMPORAL: deja entrar si el usuario existe y está activo.
        // Luego lo quitamos y volvemos a bcrypt.
        const sessionId = crypto.randomUUID();

        await supabaseAdmin
          .from("app_users")
          .update({
            active_session_id: sessionId,
            last_login_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        await supabaseAdmin.from("login_logs").insert({
          user_id: user.id,
          email: user.email,
          role: "USER",
          ip: null,
          user_agent: null,
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: "USER",
          plan: user.plan,
          active: user.active,
          blocked: false,
          expires_at: user.expires_at,
          sessionId,
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