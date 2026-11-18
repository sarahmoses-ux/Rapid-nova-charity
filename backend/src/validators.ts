import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
export const email = z.string().trim().email().max(200).transform(value => value.toLowerCase());
export const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
export const checkoutInput = z.object({
  name: text(120), email, phone: optionalText(40), dedication: optionalText(250),
  anonymous: z.boolean().default(false), consent: z.boolean().default(false),
  frequency: z.enum(['once','monthly']), amount: z.number().int().min(100).max(1000000),
  allocation: z.string().max(130).regex(/^(general|(campaign|cause):[a-z0-9-]+)$/),
});
const identity = { name: text(120), email, phone: optionalText(40) };
const consent = z.literal(true);
export const intakeSchemas = {
  volunteer: z.object({ ...identity, location: text(200), interest: text(200), skills: text(4000), availability: text(200), message: text(4000), consent }),
  partner: z.object({ ...identity, organization: text(200), interest: text(200), message: text(4000) }),
  contact: z.object({ ...identity, subject: text(200), message: text(4000) }),
  newsletter: z.object({ email, consent }),
  event: z.object({ name: text(120), email, consent }),
};
const https = z.string().url().max(2000).refine(url => new URL(url).protocol === 'https:');
const date = z.string().datetime().transform(value => new Date(value));
export const contentInput = z.object({
  title: text(200), slug, summary: z.string().trim().max(500).default(''), body: z.string().trim().max(40000).default(''),
  status: z.enum(['draft','published','active','completed','paused','archived','cancelled']),
  cause: slug.optional(), date: date.optional(), deadline: date.optional(), location: optionalText(200), organizer: optionalText(200),
  image: https.optional(), link: https.optional(), value: z.number().finite().nonnegative().optional(), unit: optionalText(50),
  goal: z.number().int().positive().max(1000000000).optional(), currency: z.literal('usd').default('usd'),
});
