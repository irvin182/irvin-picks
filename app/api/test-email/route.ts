import { NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "RESEND_API_KEY no está configurada" },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Irvin Analytics <onboarding@resend.dev>",
      to: "irvinzc@gmail.com",
      subject: "Prueba Irvin Analytics",
      html: `
        <div style="font-family:Arial;background:#03070b;color:white;padding:30px;">
          <h1 style="color:#00ff99;">Irvin Analytics ✅</h1>
          <p>Este es un correo de prueba.</p>
          <p>Si recibes esto, Resend funciona correctamente.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Error enviando email" },
      { status: 500 }
    );
  }
}