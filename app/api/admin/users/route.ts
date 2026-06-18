import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";

const ALLOWED_PLANS = ["beta", "premium", "vip"];

async function isAdmin(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  return (token as any)?.role === "ADMIN" || (token as any)?.plan === "admin";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const USER_SELECT =
  "id,email,name,plan,active,expires_at,created_at,last_login_at,last_seen_at";

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return jsonError("No autorizado", 401);
  }

  const { data, error } = await supabase
    .from("app_users")
    .select(USER_SELECT)
    .order("created_at", { ascending: false });

  if (error) return jsonError("Error cargando usuarios", 500);

  return NextResponse.json({ users: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return jsonError("No autorizado", 401);
  }

  const body = await req.json();

  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();
  const plan = String(body.plan ?? "beta").trim();
  const expires_at = body.expires_at || null;

  if (!email || !password || !name) {
    return jsonError("Faltan nombre, email o contraseña", 400);
  }

  if (!email.includes("@") || email.length > 120) {
    return jsonError("Email inválido", 400);
  }

  if (password.length < 8 || password.length > 72) {
    return jsonError("La contraseña debe tener entre 8 y 72 caracteres", 400);
  }

  if (!ALLOWED_PLANS.includes(plan)) {
    return jsonError("Plan no permitido", 400);
  }

  const { data: existingUser } = await supabase
    .from("app_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    return jsonError("Ya existe un usuario con ese email", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase
    .from("app_users")
    .insert({
      email,
      password: passwordHash,
      name,
      plan,
      active: true,
      expires_at: expires_at ? new Date(expires_at).toISOString() : null,
      active_session_id: null,
      last_login_at: null,
      last_seen_at: null,
    })
    .select(USER_SELECT)
    .single();

  if (error) {
    console.error("Error creando usuario:", error);
    return jsonError("Error creando usuario", 500);
  }

  return NextResponse.json({ user: data });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return jsonError("No autorizado", 401);
  }

  const body = await req.json();
  const id = String(body.id ?? "").trim();

  if (!id) {
    return jsonError("Falta id", 400);
  }

  const updateData: any = {};

  if (typeof body.active === "boolean") {
    updateData.active = body.active;
  }

  if (body.password) {
    const newPassword = String(body.password);

    if (newPassword.length < 8 || newPassword.length > 72) {
      return jsonError("La contraseña debe tener entre 8 y 72 caracteres", 400);
    }

    if (body.forceLogout === true) {
  updateData.active_session_id = crypto.randomUUID();
  updateData.last_seen_at = null;
}

    updateData.password = await bcrypt.hash(newPassword, 12);
    updateData.active_session_id = crypto.randomUUID();
    updateData.last_seen_at = null;
  }

  if (Object.keys(updateData).length === 0) {
    return jsonError("No hay cambios para actualizar", 400);
  }

  const { data, error } = await supabase
    .from("app_users")
    .update(updateData)
    .eq("id", id)
    .select(USER_SELECT)
    .single();

  if (error) {
    console.error("Error actualizando usuario:", error);
    return jsonError("Error actualizando usuario", 500);
  }

  return NextResponse.json({ user: data });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return jsonError("No autorizado", 401);
  }

  const body = await req.json();
  const id = String(body.id ?? "").trim();

  if (!id) {
    return jsonError("Falta id", 400);
  }

  const { data, error } = await supabase
    .from("app_users")
    .delete()
    .eq("id", id)
    .select("id,email");

  if (error) {
    console.error("Error eliminando usuario:", error);
    return jsonError("Error eliminando usuario", 500);
  }

  return NextResponse.json({ ok: true, deleted: data });
}   