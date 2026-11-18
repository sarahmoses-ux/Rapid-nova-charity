# Deployment preparation

Build the frontend on Vercel and run the Express service on a Node host such as Render or Railway. Use a MongoDB Atlas user scoped to the app database. Serve both through the same public origin: proxy `/api/*` and `/sitemap.xml` to Express before the SPA fallback rewrite, preserve Stripe request bodies and signatures, and route all other application paths to `index.html`. Test cookie behavior, forwarded IP handling, webhooks, and deep links on a staging host before launch.

Set `NODE_ENV=production` and the HTTPS `SITE_ORIGIN`. Enable `TRUST_PROXY=1` only where the app is exactly one trusted proxy hop from the client. Keep secrets in the host's environment, restrict database network access and enable backups. Verify a restore in an isolated database and confirm archival and retention requirements with the organization.

## Outstanding launch work

- Complete integrated MongoDB and Stripe test-mode reconciliation checks and browser accessibility tests.
- Add administrator MFA and recovery, donor identity, receipts and subscription self-service, and the remaining finance operations.
- Complete media uploads, notification delivery, maps, advanced content and reporting, and prerendering.
- Confirm organization identity, registration, tax treatment, locations, contacts, programs, publication permissions and policies before publication.
- Obtain explicit authorization before enabling any live fundraising. The payment adapter currently rejects live credentials and events.
