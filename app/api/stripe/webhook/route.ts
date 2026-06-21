import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY");
  return new Stripe(key);
}

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Falta RESEND_API_KEY");
  return new Resend(key);
}

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function addOneMonth() {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);
  return expiresAt.toISOString();
}

async function sendWelcomeEmail({
  email,
  plan,
  password,
  isNewUser,
}: {
  email: string;
  plan: string;
  password?: string;
  isNewUser: boolean;
}) {
  const resend = getResend();
  const loginUrl = "https://irvin-picks.vercel.app/login";

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "Irvin Analytics <onboarding@resend.dev>",
    to: email,
    subject: isNewUser
      ? "🎉 Bienvenido a Irvin Analytics – Tu cuenta ya está activa"
      : "✅ Tu suscripción a Irvin Analytics está activa",
    html: `
      <div style="margin:0;padding:0;background:#03070b;font-family:Arial,sans-serif;color:#ffffff;">
        <div style="max-width:680px;margin:0 auto;padding:40px 20px;">
          <div style="text-align:center;margin-bottom:30px;">
            <h1 style="color:#00ff99;font-size:34px;margin:0;font-weight:900;">IRVIN ANALYTICS</h1>
            <p style="color:#9ca3af;margin-top:8px;">Inteligencia artificial para análisis deportivo en vivo</p>
          </div>

          <div style="background:#07111c;border:1px solid rgba(0,255,153,0.35);border-radius:24px;padding:32px;">
            <h2 style="color:#00ff99;margin-top:0;">🎉 Bienvenido a Irvin Analytics</h2>

            <p>Hola,</p>
            <p>Tu suscripción <b>${plan.toUpperCase()}</b> ha sido activada correctamente.</p>

            ${
              isNewUser
                ? `
                <div style="background:#03070b;border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:22px;margin:24px 0;">
                  <h3 style="margin-top:0;color:#ffffff;">Tus datos de acceso</h3>
                  <p><b>📧 Email:</b> ${email}</p>
                  <p><b>🔑 Contraseña temporal:</b> ${password}</p>
                </div>
                `
                : `
                <div style="background:#03070b;border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:22px;margin:24px 0;">
                  <p>Tu cuenta ya existía, por eso hemos reactivado tu acceso.</p>
                  <p><b>📧 Email:</b> ${email}</p>
                </div>
                `
            }

            <ul style="line-height:1.9;color:#d1d5db;">
              <li>✅ Predicciones mediante Inteligencia Artificial</li>
              <li>✅ Modelo Poisson avanzado</li>
              <li>✅ Match Momentum en tiempo real</li>
              <li>✅ Próximo Gol</li>
              <li>✅ Over/Under inteligente</li>
              <li>✅ BTTS / Ambos marcan</li>
              <li>✅ Informes diarios</li>
            </ul>

            <div style="text-align:center;margin-top:30px;">
              <a href="${loginUrl}" style="display:inline-block;background:#00ff99;color:#000;padding:16px 28px;border-radius:14px;font-weight:900;text-decoration:none;">
                Entrar a Irvin Analytics
              </a>
            </div>
          </div>
        </div>
      </div>
    `,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Falta firma Stripe" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json({ error: "Falta STRIPE_WEBHOOK_SECRET" }, { status: 500 });
    }

    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Webhook inválido", message: err.message },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email?.toLowerCase();
      const plan = session.metadata?.plan || "premium";

      if (!email) {
        return NextResponse.json({ error: "Cliente sin email" }, { status: 400 });
      }

      const { data: existingUser } = await supabase
        .from("app_users")
        .select("id,email")
        .eq("email", email)
        .maybeSingle();

      if (existingUser) {
        const { error } = await supabase
          .from("app_users")
          .update({
            plan,
            active: true,
            expires_at: addOneMonth(),
            stripe_customer_id: String(session.customer ?? ""),
            stripe_subscription_id: String(session.subscription ?? ""),
            active_session_id: null,
            last_seen_at: null,
          })
          .eq("email", email);

        if (error) throw error;

        await sendWelcomeEmail({ email, plan, isNewUser: false });
      } else {
        const rawPassword = generatePassword();
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        const { error } = await supabase.from("app_users").insert({
          email,
          name: email.split("@")[0],
          password: hashedPassword,
          plan,
          active: true,
          expires_at: addOneMonth(),
          stripe_customer_id: String(session.customer ?? ""),
          stripe_subscription_id: String(session.subscription ?? ""),
          active_session_id: null,
          last_seen_at: null,
          last_login_at: null,
        });

        if (error) throw error;

        await sendWelcomeEmail({
          email,
          plan,
          password: rawPassword,
          isNewUser: true,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error procesando webhook", message: error?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}