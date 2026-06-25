import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const PRICES: Record<string, { name: string; amount: number }> = {
  beta: { name: "Irvin Analytics Beta", amount: 990 },
  premium: { name: "Irvin Analytics Premium", amount: 1990 },
  vip: { name: "Irvin Analytics VIP", amount: 3990 },
};

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return new Stripe(secretKey);
}

function getBaseUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://irvin-picks.vercel.app";

  return baseUrl.replace(/\/$/, "");
}

async function createCheckout(req: NextRequest) {
  try {
    const stripe = getStripe();

    const { searchParams } = new URL(req.url);
    const plan = String(searchParams.get("plan") ?? "premium")
      .toLowerCase()
      .trim();

    const selected = PRICES[plan];

    if (!selected) {
      return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
    }

    const baseUrl = getBaseUrl();

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

      metadata: {
        plan,
        source: "irvin_analytics_checkout",
      },

      subscription_data: {
        metadata: {
          plan,
          source: "irvin_analytics_subscription",
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe no devolvió URL de pago" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(session.url);
  } catch (error: any) {
    console.error("Stripe checkout error:", error);

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