import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { z } from 'zod';
import { AdminUser, roles } from './models.js';
import { hashPassword } from './security.js';
import { email } from './validators.js';

dotenv.config({ path: new URL('../../.env', import.meta.url).pathname });
const userEmail = email.parse(process.argv[2]);
const role = z.enum(roles).parse(process.argv[3]);
if (process.stdin.isTTY) throw new Error('Pass a strong password through stdin using your secret manager.');
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const password = z.string().min(14).max(256).parse(Buffer.concat(chunks).toString().replace(/\r?\n$/, ''));
if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI.');
await mongoose.connect(process.env.MONGODB_URI);
try {
  await AdminUser.init();
  await AdminUser.create({ email: userEmail, role, passwordHash: await hashPassword(password) });
  console.log('Administrator created.');
} finally { await mongoose.disconnect(); }
