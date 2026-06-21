import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const PRICES: Record<string, { name: string; amount: number }> = {
  beta: { name: "Irvin Analytics Beta", amount: 990 },
  premium: { name: "Irvin Analytics Premium", amount: 1990 },
  vip: { name: "Irvin Analytics VIP", amount: 3990 },
};

async function createCheckout(req: NextRequest) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        { error: "Falta STRIPE_SECRET_KEY en Vercel" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey);

    const { searchParams } = new URL(req.url);
    const plan = searchParams.get("plan") || "premium";
    const selected = PRICES[plan];

    if (!selected) {
      return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://irvin-picks.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: selected.name,
            },
            unit_amount: selected.amount,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
      metadata: { plan },
    });

    return NextResponse.redirect(session.url as string);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Error creando checkout de Stripe",
        message: error?.message ?? "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return createCheckout(req);
}

export async function POST(req: NextRequest) {
  return createCheckout(req);
}