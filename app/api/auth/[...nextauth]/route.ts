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
        }

        const { data: user, error } = await supabaseAdmin
          .from("app_users")



  .select(
  "id,email,name,password,plan,active,blocked,expires_at,active_session_id,last_seen_at"
)


          .eq("email", email)
          .maybeSingle();

        if (error) {
          console.error("Login user lookup error:", error);
          return null;
        }

        if (!user) return null;
        if (user.active === false) return null;
        if (user.blocked === true) return null;

        if (
          user.expires_at &&
          new Date(user.expires_at).getTime() < Date.now()
        ) {
          return null;
        }

        let isValidPassword = false;

        try {
          isValidPassword = await bcrypt.compare(password, user.password);
        } catch {
          isValidPassword = false;
        }

        if (!isValidPassword && password === user.password) {
          isValidPassword = true;

          const newHash = await bcrypt.hash(password, 10);

          await supabaseAdmin
            .from("app_users")
            .update({ password: newHash })
            .eq("id", user.id);
        }

        if (!isValidPassword) return null;

if (user.active_session_id && user.last_seen_at) {
  const lastSeen = new Date(user.last_seen_at).getTime();
  const activeLimit = Date.now() - 15 * 1000;

  if (lastSeen > activeLimit) {
    console.log("Usuario ya conectado:", user.email);
    return null;
  }
}



        const sessionId = crypto.randomUUID();

        await supabaseAdmin
          .from("app_users")
          .update({
            active_session_id: sessionId,
            last_login_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", user.id);
const { error: logError } = await supabaseAdmin
  .from("login_logs")
  .insert({
    user_id: user.id,
    email: user.email,
    role: "USER",
    ip: "Login",
    user_agent: "NextAuth Credentials",
  });

if (logError) {
  console.error("❌ Error insertando login log:", logError);
} else {
  console.log("✅ Login guardado:", user.email);
}

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: "USER",
          plan: user.plan,
          active: user.active,
          blocked: user.blocked ?? false,
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
        token.forceLogout = false;
      }

      if (token.role === "USER" && token.id && token.sessionId) {
        const { data: dbUser } = await supabaseAdmin
          .from("app_users")
          .select("active,blocked,expires_at,active_session_id")
          .eq("id", token.id as string)
          .maybeSingle();

        if (!dbUser) {
          token.forceLogout = true;
          return token;
        }

        if (dbUser.active === false || dbUser.blocked === true) {
          token.forceLogout = true;
          return token;
        }

        if (
          dbUser.expires_at &&
          new Date(dbUser.expires_at).getTime() < Date.now()
        ) {
          token.forceLogout = true;
          return token;
        }

        if (dbUser.active_session_id !== token.sessionId) {
          token.forceLogout = true;
          return token;
        }
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
        (session.user as any).forceLogout = token.forceLogout;
      }

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };