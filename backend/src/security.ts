import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AdminUser, Session, type Role } from './models.js';
import type { Request, Response, NextFunction } from 'express';

const scrypt = promisify(scryptCallback);
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function hashPassword(password: string, salt = token()) {
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return salt + ':' + hash.toString('hex');
}
export async function verifyPassword(password: string, stored: string) {
  const expected = Buffer.from(stored);
  const actual = Buffer.from(await hashPassword(password, stored.split(':')[0]));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' };
}
export async function loggedIn(req: Request, res: Response, next: NextFunction) {
  const raw = req.cookies?.rnc_session;
  if (typeof raw !== 'string') throw new HttpError(401, 'Log in to continue.');
  const session = await Session.findOne({ tokenHash: sha256(raw), expiresAt: { $gt: new Date() } });
  const user = session && await AdminUser.findById(session.userId);
  if (!user?.role) throw new HttpError(401, 'Log in to continue.');
  res.locals.admin = { id: String(user._id), email: user.email, role: user.role };
  next();
}
const contentPermissions: Partial<Record<Role, string[]>> = {
  administrator: ['causes','campaigns','stories','events','impact','policies','partners','settings'],
  'finance-manager': ['reports'],
  'campaign-manager': ['campaigns','causes'],
  'volunteer-coordinator': ['events'],
  'content-manager': ['stories','impact','partners','settings','policies','causes'],
};
export function canEdit(role: Role, kind: string) {
  return role === 'super-admin' || Boolean(contentPermissions[role]?.includes(kind));
}
export function canFinance(role: Role) {
  return role === 'super-admin' || role === 'finance-manager';
}
export function canReview(role: Role, kind: string) {
  return role === 'super-admin' || role === 'administrator' || (role === 'volunteer-coordinator' && ['volunteer','event'].includes(kind));
}
