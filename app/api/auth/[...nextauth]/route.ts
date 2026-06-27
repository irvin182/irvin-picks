import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { saveLogin } from "@/lib/loginLogger";

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is not configured");
}

function getHeader(req: any, name: string) {
  const headers = req?.headers;

  if (!headers) return null;

  if (typeof headers.get === "function") {
    return headers.get(name);
  }

  const direct = headers[name];
  const lower = headers[name.toLowerCase()];
  const value = direct ?? lower;

  if (Array.isArray(value)) return value[0] ?? null;

  return value ?? null;
}

function getClientIp(req: any) {
  const forwarded = getHeader(req, "x-forwarded-for");

  return (
    forwarded?.split(",")[0]?.trim() ||
    getHeader(req, "x-real-ip") ||
    "Desconocida"
  );
}

function getUserAgent(req: any) {
  return getHeader(req, "user-agent") || "Desconocido";
}

async function saveLoginAttempt(
  req: any,
  payload: {
    email: string;
    success: boolean;
    reason: string;
  }
) {
  try {
    const { error } = await supabaseAdmin.from("login_attempts").insert({
      email: payload.email,
      ip: getClientIp(req),
      user_agent: getUserAgent(req),
      success: payload.success,
      reason: payload.reason,
    });

    if (error) {
      console.error("❌ ERROR INSERTANDO LOGIN_ATTEMPT:", error);
    }
  } catch (err) {
    console.error("❌ Error guardando login_attempt:", err);
  }
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

      async authorize(credentials, req) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");

        if (!email || !password) {
          await saveLoginAttempt(req, {
            email: email || "Sin email",
            success: false,
            reason: "missing_credentials",
          });

          return null;
        }

        const { data: user, error } = await supabaseAdmin
          .from("app_users")
          .select(
            "id,email,name,password,plan,active,blocked,expires_at,active_session_id,last_seen_at"
          )
          .eq("email", email)
          .maybeSingle();

        if (error || !user) {
          await saveLoginAttempt(req, {
            email,
            success: false,
            reason: "user_not_found",
          });

          return null;
        }

        if (user.active === false) {
          await saveLoginAttempt(req, {
            email,
            success: false,
            reason: "user_inactive",
          });

          return null;
        }

        if (user.blocked === true) {
          await saveLoginAttempt(req, {
            email,
            success: false,
            reason: "user_blocked",
          });

          return null;
        }

        if (
          user.expires_at &&
          new Date(user.expires_at).getTime() < Date.now()
        ) {
          await saveLoginAttempt(req, {
            email,
            success: false,
            reason: "user_expired",
          });

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

        if (!isValidPassword) {
          await saveLoginAttempt(req, {
            email,
            success: false,
            reason: "invalid_password",
          });

          return null;
        }

        const sessionId = crypto.randomUUID();
        const plan = String(user.plan ?? "").toLowerCase();
        const role = plan === "admin" ? "ADMIN" : "USER";

        await supabaseAdmin
          .from("app_users")
          .update({
            active_session_id: sessionId,
            last_login_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            login_logged: false,
          })
          .eq("id", user.id);

        await saveLoginAttempt(req, {
          email: user.email,
          success: true,
          reason: role === "ADMIN" ? "admin_login_success" : "login_success",
        });

        await saveLogin(req as any, {
          id: user.id,
          email: user.email,
          role,
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role,
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

      if (
        (token.role === "USER" || token.role === "ADMIN") &&
        token.id &&
        token.sessionId
      ) {
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