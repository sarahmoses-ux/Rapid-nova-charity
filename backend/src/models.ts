import { Schema, model } from 'mongoose';

const options = { timestamps: true };
export const contentTypes = ['causes','campaigns','stories','events','impact','reports','policies','partners','settings'] as const;
export type ContentType = typeof contentTypes[number];
const content = new Schema({
  kind: { type: String, enum: contentTypes, required: true },
  slug: { type: String, required: true },
  title: { type: String, required: true },
  summary: { type: String, default: '' },
  body: { type: String, default: '' },
  image: String, link: String, cause: String, deadline: Date, date: Date, location: String, organizer: String,
  status: { type: String, required: true, default: 'draft' },
  value: Number, unit: String, goal: Number, currency: { type: String, default: 'usd' },
}, options);
content.index({ kind: 1, slug: 1 }, { unique: true });
content.index({ kind: 1, status: 1, createdAt: -1 });
export const Content = model('Content', content);

const intake = new Schema({
  kind: { type: String, required: true },
  status: { type: String, default: 'new' },
  name: String, email: String, phone: String, location: String, organization: String, subject: String, interest: String,
  skills: String, availability: String, message: String, consent: Boolean, eventNumber: String,
}, options);
intake.index({ kind: 1, createdAt: -1 });
intake.index({ email: 1 }, { unique: true, partialFilterExpression: { kind: 'newsletter' } });
intake.index({ email: 1, eventNumber: 1 }, { unique: true, partialFilterExpression: { kind: 'event' } });
export const Intake = model('Intake', intake);

export const roles = ['super-admin','administrator','finance-manager','campaign-manager','volunteer-coordinator','content-manager'] as const;
export type Role = typeof roles[number];
export const AdminUser = model('AdminUser', new Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: roles },
}, options));
export const Session = model('Session', new Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, options));
export const AuditLog = model('AuditLog', new Schema({
  userId: Schema.Types.ObjectId, operation: String, target: String,
}, options));

export const Checkout = model('Checkout', new Schema({
  tokenHash: { type: String, unique: true, required: true },
  reference: { type: String, unique: true, required: true },
  name: String, email: String, phone: String, dedication: String, anonymous: Boolean, consent: Boolean,
  frequency: String, allocation: String, amount: Number, currency: String,
  sessionId: String, status: { type: String, default: 'pending' },
}, options));
const donation = new Schema({
  paymentIntent: { type: String, unique: true, required: true },
  checkoutId: { type: Schema.Types.ObjectId, required: true, index: true },
  allocation: { type: String, required: true },
  amount: { type: Number, required: true },
  refunded: { type: Number, default: 0 },
  currency: { type: String, required: true },
  disputed: { type: Boolean, default: false },
  updatedByEventAt: { type: Number, default: 0 },
  verifiedAt: Date,
}, options);
donation.index({ allocation: 1, currency: 1, disputed: 1 });
export const Donation = model('Donation', donation);
export const RecurringDonation = model('RecurringDonation', new Schema({
  stripeId: { type: String, unique: true, required: true },
  checkoutId: { type: Schema.Types.ObjectId, required: true, index: true },
  status: String, customerId: String, updatedByEventAt: Number,
}, options));
export const PaymentEvent = model('PaymentEvent', new Schema({
  stripeId: { type: String, unique: true, required: true },
  eventType: String,
}, options));
