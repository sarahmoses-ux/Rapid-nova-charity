# Implementation roadmap

1. Scaffold React/Vite and Express/Mongoose workspaces. Establish the navy, emerald, gold and ivory design system.
2. Create the public editorial pages, navigation, accessible forms and publication-aware empty states.
3. Model causes, campaigns, stories and reports. Expose published content through the API and provide editorial controls.
4. Connect MongoDB, validate API input and enforce authenticated role boundaries.
5. Integrate Stripe test Checkout and signed, replay-safe reconciliation. Count only verified net gifts in campaign totals.
6. Add volunteer, event, partnership, newsletter and contact intake.
7. Expand admin operations and build donor identity, receipts and subscription self-service.
8. Add transactional email delivery, retries and consent-aware communications.
9. Verify payments, permissions, privacy, accessibility and indexing in integrated environments.
10. Document deployment, operational controls and outstanding launch approvals.

Before publication, confirm registration, tax treatment, leadership, governance, operating regions, contact details, programs, safeguarding policies, financial reports, partner permissions, metrics and media consent.

## Foundation checkpoint

| Phase | Implemented | Remaining validation or scope |
| --- | --- | --- |
| 1–2 | Workspaces, design system, homepage, navigation, public routes and forms | Browser responsive and accessibility checks |
| 3–4 | MongoDB models, published content queries, editorial controls, validation and role checks | MongoDB integration tests and richer content relationships |
| 5 | Test checkout, signed webhook processing, ledger, status page and hosted monthly management link | Stripe test-mode lifecycle, replay, refund and dispute verification |
| 6 | Intake for volunteers, events, partners and contact, plus administrative review | Database-backed and browser tests, volunteer assignments |
| 7 | Admin authentication, content editing, intake, donations and finance overview | Donor accounts, MFA, password recovery, receipts, exports and refunds UI |
| 8 | Newsletter subscription, optional Resend welcome email and signed unsubscribe link | Provider verification, campaigns and remaining transactional templates |
| 9–10 | Source checks, API tests, production builds, sitemap, setup and deployment guides | Browser tests, media uploads, retention controls and deployment verification |
