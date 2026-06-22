import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_PLANS = ["beta", "premium", "vip"];

const USER_SELECT =
  "id,email,name,plan,active,expires_at,created_at,last_login_at,last_seen_at";

async function isAdmin(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  return String((token as any)?.role ?? "").toUpperCase() === "ADMIN";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120;
}

function parseExpiresAt(value: any) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "INVALID_DATE";
  }

  return date.toISOString();
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return jsonError("No autorizado", 401);
  }

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select(USER_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando usuarios:", error);
    return jsonError("Error cargando usuarios", 500);
  }

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
  const plan = String(body.plan ?? "beta").toLowerCase().trim();
  const expiresAt = parseExpiresAt(body.expires_at);

  if (!email || !password || !name) {
    return jsonError("Faltan nombre, email o contraseña", 400);
  }

  if (!isValidEmail(email)) {
    return jsonError("Email inválido", 400);
  }

  if (password.length < 8 || password.length > 72) {
    return jsonError("La contraseña debe tener entre 8 y 72 caracteres", 400);
  }

  if (!ALLOWED_PLANS.includes(plan)) {
    return jsonError("Plan no permitido", 400);
  }

  if (expiresAt === "INVALID_DATE") {
    return jsonError("Fecha de expiración inválida", 400);
  }

  const { data: existingUser, error: existingError } = await supabaseAdmin
    .from("app_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    console.error("Error comprobando usuario:", existingError);
    return jsonError("Error comprobando usuario", 500);
  }

  if (existingUser) {
    return jsonError("Ya existe un usuario con ese email", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .insert({
      email,
      password: passwordHash,
      name,
      plan,
      active: true,
      expires_at: expiresAt,
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

  if (typeof body.name === "string") {
    const name = body.name.trim();

    if (!name || name.length > 100) {
      return jsonError("Nombre inválido", 400);
    }

    updateData.name = name;
  }

  if (typeof body.plan === "string") {
    const plan = body.plan.toLowerCase().trim();

    if (!ALLOWED_PLANS.includes(plan)) {
      return jsonError("Plan no permitido", 400);
    }

    updateData.plan = plan;
  }

  if (typeof body.active === "boolean") {
    updateData.active = body.active;

    if (body.active === false) {
      updateData.active_session_id = crypto.randomUUID();
      updateData.last_seen_at = null;
    }
  }

  if ("expires_at" in body) {
    const expiresAt = parseExpiresAt(body.expires_at);

    if (expiresAt === "INVALID_DATE") {
      return jsonError("Fecha de expiración inválida", 400);
    }

    updateData.expires_at = expiresAt;
  }

  if (typeof body.password === "string" && body.password.length > 0) {
    const newPassword = body.password;

    if (newPassword.length < 8 || newPassword.length > 72) {
      return jsonError("La contraseña debe tener entre 8 y 72 caracteres", 400);
    }

    updateData.password = await bcrypt.hash(newPassword, 12);
    updateData.active_session_id = crypto.randomUUID();
    updateData.last_seen_at = null;
  }

  if (body.forceLogout === true) {
    updateData.active_session_id = crypto.randomUUID();
    updateData.last_seen_at = null;
  }

  if (Object.keys(updateData).length === 0) {
    return jsonError("No hay cambios para actualizar", 400);
  }

  const { data, error } = await supabaseAdmin
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

  const { data, error } = await supabaseAdmin
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