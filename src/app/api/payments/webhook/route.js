import Stripe from 'stripe';
import { confirmStripeCheckoutSession } from '@/app/api/utils/monetization';

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey);
}

export async function POST(request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get('stripe-signature');
  const stripe = getStripeClient();

  if (!stripe || !webhookSecret) {
    return Response.json({ error: 'Stripe webhook is not configured.' }, { status: 503 });
  }

  if (!signature) {
    return Response.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  const body = await request.text();

  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await confirmStripeCheckoutSession({ sessionId: session.id, userId: session.metadata?.userId });
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to process Stripe webhook.' },
      { status: 400 }
    );
  }
}
