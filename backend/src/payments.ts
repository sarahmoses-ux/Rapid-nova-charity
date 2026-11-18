import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import express from 'express';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import { Checkout, Content, Donation, PaymentEvent, RecurringDonation } from './models.js';
import { checkoutInput } from './validators.js';
import { HttpError, sha256, token } from './security.js';

export function checkoutEnabled() {
  return process.env.ENABLE_STRIPE_TEST === 'true'
    && Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') && process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'));
}
function stripe() {
  if (!checkoutEnabled()) throw new HttpError(503, 'Stripe test checkout is unavailable.');
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}
export const netCents = (amount: number, refunded: number, disputed: boolean) => disputed ? 0 : Math.max(0, amount - refunded);

export function paymentRoutes(app: Express) {
  app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const provider = stripe();
    let event: Stripe.Event;
    try {
      event = provider.webhooks.constructEvent(req.body, req.get('stripe-signature') || '', process.env.STRIPE_WEBHOOK_SECRET!);
    } catch {
      throw new HttpError(400, 'Invalid webhook signature.');
    }
    if (event.livemode) throw new HttpError(400, 'Live payments are disabled.');
    if (await PaymentEvent.exists({ stripeId: event.id })) { res.json({ received: true }); return; }
    await reconcile(provider, event);
    await PaymentEvent.updateOne({ stripeId: event.id }, { $setOnInsert: { eventType: event.type } }, { upsert: true });
    res.json({ received: true });
  });
}
export function checkoutRoutes(app: Express, siteOrigin: string) {
  app.post('/api/donations/checkout', async (req, res) => {
    const data = checkoutInput.parse(req.body);
    const provider = stripe();
    if (data.allocation !== 'general') {
      const [type, slug] = data.allocation.split(':');
      const eligible = await Content.exists({
        kind: type === 'cause' ? 'causes' : 'campaigns', slug,
        status: type === 'cause' ? 'published' : 'active',
        ...(type === 'campaign' ? { $or: [{ deadline: { $exists: false } }, { deadline: { $gt: new Date() } }] } : {}),
      });
      if (!eligible) throw new HttpError(400, 'This fund is unavailable.');
    }
    const rawToken = token();
    const pending = await Checkout.create({ ...data, tokenHash: sha256(rawToken), reference: 'RNC-' + randomUUID(), currency: 'usd' });
    const monthly = data.frequency === 'monthly';
    const metadata = { checkoutId: String(pending._id) };
    const session = await provider.checkout.sessions.create({
      mode: monthly ? 'subscription' : 'payment',
      customer_email: data.email,
      line_items: [{ quantity: 1, price_data: {
        currency: 'usd', unit_amount: data.amount, product_data: { name: 'Rapid Nova Charity test donation' },
        ...(monthly ? { recurring: { interval: 'month' } } : {}),
      } }],
      metadata,
      ...(monthly ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
      success_url: siteOrigin + '/donate/status?ref=' + rawToken,
      cancel_url: siteOrigin + '/donate',
    }, { idempotencyKey: String(pending._id) });
    await Checkout.updateOne({ _id: pending._id }, { $set: { sessionId: session.id } });
    if (!session.url) throw new HttpError(502, 'The payment provider did not return a checkout URL.');
    res.status(201).json({ data: { url: session.url } });
  });
  app.post('/api/donations/manage', async (req, res) => {
    const raw = req.body?.token;
    if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) throw new HttpError(404, 'Donation reference was not found.');
    const checkout = await Checkout.findOne({ tokenHash: sha256(raw), frequency: 'monthly', status: 'paid' }).select('_id');
    const subscription = checkout && await RecurringDonation.findOne({ checkoutId: checkout._id }).select('customerId');
    if (!subscription?.customerId) throw new HttpError(404, 'Subscription was not found.');
    const session = await stripe().billingPortal.sessions.create({
      customer: subscription.customerId,
      return_url: siteOrigin + '/donate/status?ref=' + raw,
    });
    res.json({ data: { url: session.url } });
  });
  app.get('/api/donations/status/:token', async (req, res) => {
    const record = /^[a-f0-9]{64}$/.test(req.params.token) && await Checkout.findOne({ tokenHash: sha256(req.params.token) }).select('reference status frequency amount currency').lean();
    if (!record) throw new HttpError(404, 'Donation reference was not found.');
    const recurring = record.frequency === 'monthly' && await RecurringDonation.exists({ checkoutId: record._id });
    res.set('Cache-Control', 'no-store').json({ data: {
      reference: record.reference, status: record.status, canManage: !!recurring && record.status === 'paid',
      ...(record.status === 'paid' ? { amount: record.amount, currency: record.currency } : {}),
    } });
  });
}

async function checkoutFromIntent(provider: Stripe, intent: Stripe.PaymentIntent) {
  let id = intent.metadata.checkoutId;
  if (!id) {
    const payments = await provider.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: intent.id }, status: 'paid', limit: 1 });
    const invoiceRef = payments.data[0]?.invoice;
    if (invoiceRef) {
      const invoice = typeof invoiceRef === 'string' ? await provider.invoices.retrieve(invoiceRef) : invoiceRef;
      if (!('deleted' in invoice)) id = invoice.parent?.subscription_details?.metadata?.checkoutId || '';
    }
  }
  return mongoose.isValidObjectId(id) ? Checkout.findById(id) : null;
}

async function saveCharge(provider: Stripe, intent: Stripe.PaymentIntent, timestamp: number) {
  const checkout = await checkoutFromIntent(provider, intent);
  if (!checkout || !checkout.allocation || !intent.latest_charge || intent.status !== 'succeeded') return;
  if (intent.currency !== checkout.currency) throw new Error('Currency mismatch in payment reconciliation.');
  const charge = await provider.charges.retrieve(typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge.id);
  let disputed = charge.disputed;
  if (disputed) {
    const disputes = await provider.disputes.list({ charge: charge.id, limit: 100 });
    disputed = !disputes.data.length || disputes.data.some(dispute => !['won','warning_closed'].includes(dispute.status));
  }
  await Donation.updateOne(
    { paymentIntent: intent.id },
    [{ $set: {
      checkoutId: checkout._id, allocation: checkout.allocation, amount: charge.amount_captured, currency: charge.currency,
      verifiedAt: { $ifNull: ['$verifiedAt', new Date(charge.created * 1000)] },
      refunded: { $max: [{ $ifNull: ['$refunded', 0] }, charge.amount_refunded] },
      disputed: { $cond: [{ $lte: [{ $ifNull: ['$updatedByEventAt', 0] }, timestamp] }, disputed, '$disputed'] },
      updatedByEventAt: { $max: [{ $ifNull: ['$updatedByEventAt', 0] }, timestamp] },
    } }],
    { upsert: true },
  );
  const status = disputed ? 'disputed' : charge.amount_refunded >= charge.amount_captured ? 'refunded' : 'paid';
  if (checkout.frequency === 'once') await Checkout.updateOne({ _id: checkout._id }, { $set: { status } });
  else await Checkout.updateOne({ _id: checkout._id, status: 'pending' }, { $set: { status: 'paid' } });
}

async function reconcile(provider: Stripe, event: Stripe.Event) {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await saveCharge(provider, event.data.object, event.created);
      break;
    case 'invoice.paid': {
      const invoice = event.data.object;
      const payments = await provider.invoicePayments.list({ invoice: invoice.id, limit: 100 });
      for (const record of payments.data) {
        const intentId = record.payment.payment_intent;
        if (record.status === 'paid' && typeof intentId === 'string') await saveCharge(provider, await provider.paymentIntents.retrieve(intentId), event.created);
      }
      break;
    }
    case 'charge.refunded':
    case 'charge.dispute.created':
    case 'charge.dispute.closed':
    case 'charge.dispute.updated': {
      const intentId = event.data.object.payment_intent;
      if (typeof intentId === 'string') await saveCharge(provider, await provider.paymentIntents.retrieve(intentId), event.created);
      break;
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      const id = event.data.object.metadata?.checkoutId;
      if (mongoose.isValidObjectId(id)) await Checkout.updateOne({ _id: id, status: 'pending' }, { $set: { status: 'failed' } });
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = await provider.subscriptions.retrieve(event.data.object.id);
      const id = sub.metadata.checkoutId;
      if (!mongoose.isValidObjectId(id)) return;
      await RecurringDonation.updateOne({ stripeId: sub.id }, [{
        $set: {
          checkoutId: new mongoose.Types.ObjectId(id),
          customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
          status: { $cond: [{ $lte: [{ $ifNull: ['$updatedByEventAt', 0] }, event.created] }, sub.status, '$status'] },
          updatedByEventAt: { $max: [{ $ifNull: ['$updatedByEventAt', 0] }, event.created] },
        },
      }], { upsert: true });
      break;
    }
  }
}
