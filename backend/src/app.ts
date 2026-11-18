import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { z, ZodError } from 'zod';
import { AdminUser, AuditLog, Checkout, Content, Donation, Intake, RecurringDonation, Session, contentTypes } from './models.js';
import { canEdit, canFinance, canReview, cookieOptions, hashPassword, HttpError, loggedIn, sha256, token, verifyPassword } from './security.js';
import { checkoutEnabled, checkoutRoutes, paymentRoutes } from './payments.js';
import { newsletterReady, subscriberId, welcomeSubscriber } from './notifications.js';
import { contentInput, email, intakeSchemas, slug } from './validators.js';

const publication = (kind: string) => kind === 'campaigns' ? ['active','completed'] : ['published'];
const kinds = z.enum(contentTypes);
const intakeKinds = z.enum(['volunteer','partner','contact','newsletter','event']);
const filters = z.object({
  search: z.string().trim().max(200).optional(), cause: z.string().max(120).optional(),
  sort: z.enum(['recent','progress','']).optional(), status: z.string().max(20).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
const progressStages: mongoose.PipelineStage[] = [
  { $lookup: { from: Donation.collection.name, let: { fund: { $concat: ['campaign:', '$slug'] }, currency: '$currency' }, pipeline: [
    { $match: { disputed: false, $expr: { $and: [{ $eq: ['$allocation','$$fund'] },{ $eq: ['$currency','$$currency'] }] } } },
    { $group: { _id: null, net: { $sum: { $max: [0, { $subtract: ['$amount','$refunded'] }] } } } },
  ], as: 'totals' } },
  { $set: { raised: { $ifNull: [{ $first: '$totals.net' }, 0] } } },
  { $unset: 'totals' },
];

export function createApp(siteOrigin = 'http://localhost:5173') {
  const app = express();
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }));
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ data: { database: mongoose.connection.readyState === 1 } }));
  paymentRoutes(app);
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'Too many requests. Try again shortly.' } }));
  app.use((req, _res, next) => {
    if (['POST','PUT','PATCH','DELETE'].includes(req.method) && req.get('origin') !== siteOrigin) throw new HttpError(403, 'Request origin is not allowed.');
    next();
  });
  app.use(express.json({ limit: '80kb' }), cookieParser());
  checkoutRoutes(app, siteOrigin);

  app.get('/api/settings/public', async (_req, res) => {
    const setting = await Content.findOne({ kind: 'settings', slug: 'announcement', status: 'published' }).select('summary').lean();
    res.json({ data: { announcement: setting?.summary, checkoutEnabled: checkoutEnabled() } });
  });

  app.get('/sitemap.xml', async (_req, res) => {
    const publicKinds = ['causes', 'campaigns', 'stories', 'events'];
    const routes = ['', '/about', '/causes', '/campaigns', '/impact', '/get-involved', '/stories',
      '/contact', '/donate', '/events', '/partners', '/volunteer', '/transparency', '/fundraise'];
    for (const kind of publicKinds) {
      const records = await Content.find({ kind, status: { $in: publication(kind) } }).select('slug').lean();
      for (const record of records) {
        if (slug.safeParse(record.slug).success) routes.push('/' + kind + '/' + record.slug);
      }
    }
    const urls = routes.map(path => '<url><loc>' + siteOrigin + path + '</loc></url>').join('');
    res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '</urlset>');
  });

  for (const kind of contentTypes) {
    if (kind === 'settings') continue;
    app.get('/api/' + kind, async (req, res) => {
      const query = filters.parse(req.query);
      const allowed = publication(kind);
      if (query.status && !allowed.includes(query.status)) throw new HttpError(400, 'Invalid public status.');
      const filter = { kind, status: query.status || { $in: allowed },
        ...(query.cause ? { cause: slug.parse(query.cause) } : {}),
        ...(query.search ? { $or: ['title','summary'].map(field => ({ [field]: { $regex: query.search!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } })) } : {}),
      };
      const sort: mongoose.PipelineStage.Sort['$sort'] = query.sort === 'progress' && kind === 'campaigns' ? { completion: -1, createdAt: -1, _id: -1 } : { createdAt: -1, _id: -1 };
      const stages: mongoose.PipelineStage[] = [{ $match: filter }];
      if (kind === 'campaigns') stages.push(...progressStages, { $set: { completion: { $cond: [{ $gt: ['$goal', 0] }, { $divide: ['$raised','$goal'] }, 0] } } });
      stages.push({ $sort: sort }, { $skip: (query.page - 1) * 24 }, { $limit: 24 }, { $unset: ['__v','completion'] });
      res.json({ data: await Content.aggregate(stages), page: query.page });
    });
    app.get('/api/' + kind + '/:slug', async (req, res) => {
      const match = { kind, slug: slug.parse(req.params.slug), status: { $in: publication(kind) } };
      const [item] = await Content.aggregate([{ $match: match }, ...(kind === 'campaigns' ? progressStages : []), { $unset: '__v' }]);
      if (!item) throw new HttpError(404, 'Content was not found.');
      res.json({ data: item });
    });
  }

  const intakePaths = { volunteer: '/api/volunteers/apply', partner: '/api/partnerships/inquire', contact: '/api/contact', newsletter: '/api/newsletter/subscribe' } as const;
  for (const kind of Object.keys(intakePaths) as (keyof typeof intakePaths)[]) {
    app.post(intakePaths[kind], async (req, res) => {
      const data = intakeSchemas[kind].parse(req.body);
      if (kind === 'newsletter') {
        if (!newsletterReady()) throw new HttpError(503, 'Newsletter sign-up is currently unavailable.');
        const subscriber = await Intake.findOneAndUpdate({ kind, email: data.email }, { $setOnInsert: data }, { upsert: true, new: true });
        if (!subscriber) throw new HttpError(503, 'Newsletter sign-up is currently unavailable.');
        if (subscriber.status === 'new') {
          await welcomeSubscriber(data.email, String(subscriber._id), siteOrigin);
          await Intake.updateOne({ _id: subscriber._id }, { $set: { status: 'subscribed' } });
        }
      } else await Intake.create({ kind, ...data });
      res.status(201).json({ data: { received: true } });
    });
  }
  app.post('/api/newsletter/unsubscribe', async (req, res) => {
    const data = z.object({ token: z.string().regex(/^[a-f0-9]{24}\.[a-f0-9]{64}$/) }).parse(req.body);
    await Intake.deleteOne({ kind: 'newsletter', _id: subscriberId(data.token) });
    res.json({ data: { received: true } });
  });
  app.post('/api/events/:id/register', async (req, res) => {
    const data = intakeSchemas.event.parse(req.body);
    if (!mongoose.isValidObjectId(req.params.id) || !await Content.exists({ _id: req.params.id, kind: 'events', status: 'published', date: { $gt: new Date() } }))
      throw new HttpError(404, 'This event is unavailable for registration.');
    await Intake.updateOne({ kind: 'event', eventNumber: req.params.id, email: data.email }, { $setOnInsert: data }, { upsert: true });
    res.status(201).json({ data: { received: true } });
  });

  const loginLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, message: { error: 'Too many login attempts.' } });
  const dummyHash = hashPassword(token());
  app.post('/api/auth/login', loginLimit, async (req, res) => {
    const credentials = z.object({ email, password: z.string().min(1).max(256) }).parse(req.body);
    const user = await AdminUser.findOne({ email: credentials.email }).select('+passwordHash');
    if (!await verifyPassword(credentials.password, user?.passwordHash || await dummyHash) || !user) throw new HttpError(401, 'Invalid credentials.');
    const raw = token();
    const maxAge = 8 * 60 * 60 * 1000;
    if (typeof req.cookies.rnc_session === 'string') await Session.deleteOne({ tokenHash: sha256(req.cookies.rnc_session) });
    await Session.create({ userId: user._id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + maxAge) });
    res.cookie('rnc_session', raw, { ...cookieOptions(), maxAge }).json({ data: { email: user.email, role: user.role } });
  });
  app.post('/api/auth/logout', async (req, res) => {
    if (typeof req.cookies.rnc_session === 'string') await Session.deleteOne({ tokenHash: sha256(req.cookies.rnc_session) });
    res.clearCookie('rnc_session', cookieOptions()).json({ data: { signedOut: true } });
  });
  app.get('/api/auth/me', loggedIn, (_req, res) => res.json({ data: res.locals.admin }));

  app.use('/api/admin', loggedIn);
  app.get('/api/admin/overview', async (_req, res) => {
    const { role } = res.locals.admin;
    const data: Record<string, unknown> = {};
    if (canEdit(role, 'campaigns')) {
      data.activeCampaigns = await Content.countDocuments({ kind: 'campaigns', status: 'active' });
      data.completedCampaigns = await Content.countDocuments({ kind: 'campaigns', status: 'completed' });
    }
    if (canReview(role, 'volunteer')) {
      data.volunteerApplications = await Intake.countDocuments({ kind: 'volunteer' });
      data.events = await Content.countDocuments({ kind: 'events', status: 'published', date: { $gt: new Date() } });
    }
    if (canReview(role, 'partner')) data.partnershipInquiries = await Intake.countDocuments({ kind: 'partner' });
    if (canFinance(role)) {
      const [totals] = await Donation.aggregate([{ $group: {
        _id: null, grossCents: { $sum: '$amount' },
        netCents: { $sum: { $cond: ['$disputed', 0, { $max: [0, { $subtract: ['$amount','$refunded'] }] }] } },
        count: { $sum: 1 },
      } }]);
      data.finance = { grossCents: totals?.grossCents ?? 0, netCents: totals?.netCents ?? 0, donationCount: totals?.count ?? 0, activeRecurring: await RecurringDonation.countDocuments({ status: 'active' }) };
      data.monthly = await Donation.aggregate([{ $match: { disputed: false } }, { $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$verifiedAt' } }, netCents: { $sum: { $subtract: ['$amount','$refunded'] } },
      } }, { $sort: { _id: -1 } }, { $limit: 12 }, { $sort: { _id: 1 } }]);
    }
    res.json({ data });
  });
  app.get('/api/admin/donations', async (_req, res) => {
    if (!canFinance(res.locals.admin.role)) throw new HttpError(403, 'Finance access required.');
    const data = await Donation.aggregate([
      { $sort: { verifiedAt: -1 } }, { $limit: 100 }, { $lookup: { from: Checkout.collection.name, localField: 'checkoutId', foreignField: '_id', as: 'source' } },
      { $project: { amount: 1, refunded: 1, disputed: 1, currency: 1, verifiedAt: 1, allocation: 1, reference: { $first: '$source.reference' } } },
    ]);
    res.json({ data });
  });
  app.get('/api/admin/content/:kind', async (req, res) => {
    const kind = kinds.parse(req.params.kind);
    if (!canEdit(res.locals.admin.role, kind)) throw new HttpError(403, 'Content permission required.');
    res.json({ data: await Content.find({ kind }).sort({ createdAt: -1 }).limit(100).lean() });
  });
  app.put('/api/admin/content/:kind/:slug', async (req, res) => {
    const kind = kinds.parse(req.params.kind);
    const key = slug.parse(req.params.slug);
    if (!canEdit(res.locals.admin.role, kind)) throw new HttpError(403, 'Content permission required.');
    const data = contentInput.parse(req.body);
    if (data.slug !== key) throw new HttpError(400, 'The slug must match the URL.');
    const valid = kind === 'campaigns' ? ['draft','active','completed','paused','archived'] : ['draft','published','archived', ...(kind === 'events' ? ['cancelled'] : [])];
    if (!valid.includes(data.status) || (kind === 'campaigns' && !data.goal) || (kind === 'events' && data.status === 'published' && !data.date)
      || (kind === 'impact' && data.status === 'published' && data.value === undefined)) throw new HttpError(400, 'Check the status and required publication fields.');
    const removable = ['image','link','goal','cause','deadline','date','location','organizer','value','unit'] as const;
    const unset = Object.fromEntries(removable.filter(field => data[field] === undefined).map(field => [field, 1]));
    const record = await Content.findOneAndUpdate({ kind, slug: key }, { $set: data, $unset: unset }, { new: true, upsert: true, runValidators: true });
    await AuditLog.create({ userId: res.locals.admin.id, operation: 'save-content', target: kind + '/' + key });
    res.json({ data: record });
  });
  app.get('/api/admin/intake/:kind', async (req, res) => {
    const kind = intakeKinds.parse(req.params.kind);
    if (!canReview(res.locals.admin.role, kind)) throw new HttpError(403, 'Intake permission required.');
    res.json({ data: await Intake.find({ kind }).sort({ createdAt: -1 }).limit(100).lean() });
  });
  app.patch('/api/admin/intake/:id', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Submission not found.');
    const { status } = z.object({ status: z.enum(['new','under-review','accepted','waitlisted','rejected','withdrawn']) }).parse(req.body);
    const row = await Intake.findById(req.params.id);
    if (!row?.kind || !canReview(res.locals.admin.role, row.kind)) throw new HttpError(404, 'Submission not found.');
    if (row.kind === 'newsletter') throw new HttpError(400, 'Newsletter consent is managed by the subscriber.');
    row.status = status;
    await row.save();
    await AuditLog.create({ userId: res.locals.admin.id, operation: 'update-intake', target: String(row._id) });
    res.json({ data: row });
  });
  app.get('/api/admin/audit', async (_req, res) => {
    if (res.locals.admin.role !== 'super-admin') throw new HttpError(403, 'Audit access required.');
    res.json({ data: await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean() });
  });
  app.use((_req, res) => { res.status(404).json({ error: 'Endpoint not found.' }); });
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    void _next;
    if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof ZodError) { res.status(400).json({ error: 'Check the supplied fields.', fields: error.flatten().fieldErrors }); return; }
    if (error?.type === 'entity.parse.failed') { res.status(400).json({ error: 'Invalid JSON.' }); return; }
    if (error?.type === 'entity.too.large') { res.status(413).json({ error: 'Request body is too large.' }); return; }
    if (error?.code === 11000) { res.status(409).json({ error: 'This record already exists.' }); return; }
    res.status(503).json({ error: 'The service is temporarily unavailable.' });
  };
  app.use(errors);
  return app;
}
