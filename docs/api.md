# API reference

Responses use `{ data }` on success and `{ error, fields? }` on failure. Collections return up to 24 public records per page. All application mutations require the configured site Origin. The Stripe webhook uses Stripe signature verification.

| Method | Path | Access |
| --- | --- | --- |
| GET | /api/health, /sitemap.xml | Public |
| GET | /api/settings/public | Public |
| GET | /api/{causes,campaigns,stories,events,impact,reports,policies,partners}[/:slug] | Published records |
| POST | /api/donations/checkout | Public, test credentials required |
| GET | /api/donations/status/:token | Token in checkout return URL |
| POST | /api/donations/manage | Monthly donor with verified checkout token |
| POST | /api/payments/stripe/webhook | Stripe signature |
| POST | /api/volunteers/apply, /api/partnerships/inquire, /api/contact | Public |
| POST | /api/events/:id/register | Public, future published event |
| POST | /api/newsletter/subscribe, /api/newsletter/unsubscribe | Consent or signed token |
| POST | /api/auth/login, /api/auth/logout | Administrator authentication |
| GET | /api/auth/me, /api/admin/overview | Authenticated administrator |
| GET | /api/admin/donations | Finance or super admin |
| GET | /api/admin/content/:kind | Content role required |
| PUT | /api/admin/content/:kind/:slug | Content role required |
| GET | /api/admin/intake/:kind | Intake role required |
| PATCH | /api/admin/intake/:id | Intake role required |
| GET | /api/admin/audit | Super admin |

Public collection parameters are `page`, `search`, `cause`, `status` and `sort`. Checkout takes `name`, `email`, integer USD cents in `amount`, `frequency` (once/monthly), and `allocation` (general, cause:slug or campaign:slug). Optional fields are `phone`, `dedication`, `anonymous` and `consent`. See `validators.ts` for intake and publishing schemas.
