# Rapid Nova Charity

Local development foundation for the public nonprofit website and its administrative API. The public site presents proposed causes and reads published campaigns, stories, reports, events and verified impact records from MongoDB.

## Run locally

1. Install Node.js 22 or later and start MongoDB.
2. Run `npm ci` from this directory.
3. Copy `.env.example` to `.env` and set `MONGODB_URI`. Vite proxies `/api` to port 4000.
4. Run `npm run api` and `npm run dev` in separate terminals. Open http://localhost:5173.
5. To provision an administrator, pipe a strong password from your secret manager into `npm exec -- tsx backend/src/create-admin.ts EMAIL ROLE`. Supported roles are super-admin, administrator, finance-manager, campaign-manager, volunteer-coordinator and content-manager. Sign in at `/admin`.

Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` from the root.

## Stripe test checkout

Set `ENABLE_STRIPE_TEST=true`, supply a Stripe test secret key and a signing secret, and forward Stripe events to `/api/payments/stripe/webhook`. Subscribe to payment intent success, invoice paid, charge refund and dispute events, checkout expiration and asynchronous failure, and subscription create/update/delete. Confirm behavior with one-time payments, recurring invoice renewals, refunds, disputes and duplicate delivery before counting on the integration. Configure the Stripe test billing portal with cancellation enabled to exercise monthly self-service. Test transaction totals are labeled in the public and admin interfaces.

## Newsletter

Configure a verified Resend sender, an API key and a stable random `NEWSLETTER_SECRET` of at least 32 characters. Subscription sends a welcome email containing a signed unsubscribe link. Campaign delivery remains pending.

## Project documentation

- [Implementation roadmap](docs/roadmap.md)
- [API reference](docs/api.md)
- [Deployment preparation](docs/deployment.md)

The illustrative volunteer photographs are by Joel Muniz and are credited on the site. They depict independent volunteer activity. [Hero photo](https://unsplash.com/photos/volunteers-sorting-canned-food-donations-3k3l2brxmwQ) · [Volunteer photo](https://unsplash.com/photos/people-packing-food-in-plastic-bags-qvzjG2pF4bE)
