import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from './app.js';
import { canEdit, canFinance, canReview, hashPassword, verifyPassword } from './security.js';
import { checkoutEnabled, netCents } from './payments.js';

const origin = 'http://localhost:5173';
const app = createApp(origin);

test('health responds without advertising a database connection', async () => {
  await request(app).get('/api/health').expect(200, { data: { database: false } });
});
test('mutations require the configured origin', async () => {
  await request(app).post('/api/contact').set('Origin', 'https://unrelated.example').send({}).expect(403);
});
test('admin data requires a session', async () => {
  for (const path of ['/api/admin/overview','/api/admin/donations','/api/admin/intake/volunteer','/api/auth/me']) {
    await request(app).get(path).expect(401);
  }
});
test('administrator registration is unavailable', async () => {
  await request(app).post('/api/auth/register').set('Origin', origin).send({}).expect(404);
});
test('role rules constrain finance, publishing and intake independently', () => {
  assert.equal(canFinance('administrator'), false);
  assert.equal(canFinance('finance-manager'), true);
  assert.equal(canEdit('campaign-manager', 'campaigns'), true);
  assert.equal(canEdit('campaign-manager', 'reports'), false);
  assert.equal(canReview('volunteer-coordinator', 'volunteer'), true);
  assert.equal(canReview('volunteer-coordinator', 'newsletter'), false);
});
test('password hashes use separate salts and verify the correct password', async () => {
  const first = await hashPassword('test-example-password');
  assert.notEqual(first, await hashPassword('test-example-password'));
  assert.equal(await verifyPassword('test-example-password', first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
});
test('volunteer, event and newsletter intake require explicit consent', async () => {
  const details = { email: 'person@example.com', name: 'Test Person', location: 'General location', interest: 'Education', skills: 'Tutoring', availability: 'Saturday', message: 'I would like to help.', consent: false };
  for (const path of ['/api/volunteers/apply','/api/events/000000000000000000000000/register','/api/newsletter/subscribe']) {
    const response = await request(app).post(path).set('Origin', origin).send(details).expect(400);
    assert.ok(response.body.fields.consent);
  }
});
test('checkout validates integer minor units and rejects live credentials', async t => {
  const prior = { ...process.env };
  t.after(() => { process.env = prior; });
  process.env.ENABLE_STRIPE_TEST = 'true';
  process.env.STRIPE_SECRET_KEY = 'sk_live_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
  assert.equal(checkoutEnabled(), false);
  const gift = { name: 'Test Donor', email: 'donor@example.com', allocation: 'general', frequency: 'once' };
  await request(app).post('/api/donations/checkout').set('Origin', origin).send({ ...gift, amount: 120.5 }).expect(400);
  await request(app).post('/api/donations/checkout').set('Origin', origin).send({ ...gift, amount: 5000 }).expect(503);
});
test('Stripe rejects unsigned webhook requests before database I/O', async t => {
  const prior = { ...process.env };
  t.after(() => { process.env = prior; });
  process.env.ENABLE_STRIPE_TEST = 'true';
  process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
  await request(app).post('/api/payments/stripe/webhook').send({ type: 'payment_intent.succeeded' }).expect(400);
});
test('net gift calculation excludes disputed amounts and deducts refunds', () => {
  assert.equal(netCents(3500, 500, false), 3000);
  assert.equal(netCents(3500, 0, true), 0);
  assert.equal(netCents(3500, 3501, false), 0);
});
test('invalid JSON and unknown endpoints return structured errors', async () => {
  await request(app).post('/api/contact').set('Origin', origin).type('json').send('{').expect(400, { error: 'Invalid JSON.' });
  await request(app).get('/missing').expect(404, { error: 'Endpoint not found.' });
});
