import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './security.js';

export function newsletterReady() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && (process.env.NEWSLETTER_SECRET?.length || 0) >= 32);
}
export function unsubscribeToken(id: string) {
  const secret = process.env.NEWSLETTER_SECRET;
  if (!secret || secret.length < 32) throw new HttpError(503, 'Newsletter service is unavailable.');
  return id + '.' + createHmac('sha256', secret).update(id).digest('hex');
}
export function subscriberId(token: string) {
  const [id] = token.split('.');
  const a = Buffer.from(token);
  const b = Buffer.from(unsubscribeToken(id));
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(400, 'The unsubscribe link is invalid.');
  return id;
}
export async function welcomeSubscriber(email: string, id: string, origin: string) {
  const url = origin + '/newsletter/unsubscribe?token=' + unsubscribeToken(id);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'newsletter-welcome/' + id },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM, to: [email],
      subject: 'Welcome to Rapid Nova Charity updates',
      text: 'Thank you for signing up for news and updates from Rapid Nova Charity.\n\nUnsubscribe: ' + url,
    }),
  });
  if (!response.ok) throw new HttpError(503, 'Newsletter email could not be delivered. Please try again later.');
}
