import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from './app.js';
dotenv.config({ path: new URL('../../.env', import.meta.url).pathname });
dotenv.config();

const siteOrigin = process.env.SITE_ORIGIN || 'http://localhost:5173';
if (new URL(siteOrigin).origin !== siteOrigin || (process.env.NODE_ENV === 'production' && !siteOrigin.startsWith('https://'))) {
  throw new Error('SITE_ORIGIN must be an origin without a trailing slash and use HTTPS in production.');
}
if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI before starting the API.');
mongoose.set('bufferCommands', false);
await mongoose.connect(process.env.MONGODB_URI);
await Promise.all(Object.values(mongoose.models).map(model => model.init()));
const server = createApp(siteOrigin).listen(Number(process.env.PORT || 4000), () => console.log('Rapid Nova API listening.'));
const stop = () => { server.close(() => { void mongoose.disconnect(); }); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
