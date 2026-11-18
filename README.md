This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Local document processing and analysis

The PDF parser, OCR, automatic redaction, local session store, and analysis client live in `src/lib/` so other interfaces can reuse them. The upload page is one UI adapter over those services.

- Text extraction and English OCR run in the browser. Tesseract.js downloads its OCR engine/language assets at runtime; PDF content is processed locally and is not sent to fetch those assets.
- Saved sessions are opt-in, stored in IndexedDB on the current browser/device, and removed after seven days of inactivity when the app next opens.
- Analysis sends only the user-approved redacted text to the server route. The server forwards it to OpenAI with response storage disabled and does not write the request or response to an application database.
- Supabase Auth stores account identity; Postgres stores only credit balances, credit ledger entries, Stripe event/session identifiers, and analysis request timestamps. Documents, extracted text, OCR text, redaction rules, and analysis requests/results are not written to Supabase.
- Apply `supabase/migrations/20261103000000_credit_ledger.sql` to the Supabase project. Configure Auth email confirmation redirects to `${APP_BASE_URL}/auth/callback` and add the exact callback URL to Supabase's allowed redirects.
- Create Stripe one-time prices for one and five analysis credits. Configure `STRIPE_PRICE_SINGLE`, `STRIPE_PRICE_PACK`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`; send `checkout.session.completed` and `checkout.session.async_payment_succeeded` events to `/api/billing/webhook`.
- Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SECRET_KEY`. Also set `OPENAI_API_KEY` and `OPENAI_MODEL`. Keep `ANALYSIS_ENABLED=false` until Supabase and Stripe configuration is complete and verified. OpenAI's default abuse-monitoring retention can apply to API content.
- Analysis credits are reserved atomically before an OpenAI request. The database rate-limits each account to five attempts per minute. A failed OpenAI request gets an idempotent credit refund. Stripe webhook fulfillment verifies the signed event, paid status, configured price, and pack size before crediting; duplicate events cannot grant credits twice.
- Redacted PDF downloads are rebuilt from approved text only. They do not copy the source PDF, source images, hidden text, source filename, or source metadata. Page layout and images are not preserved; unsupported characters stop export with a clear error.

Run unit tests with `npm test`.

To try real OpenAI analysis locally without configuring Supabase or Stripe, create `.env.local` with `OPENAI_API_KEY`, `OPENAI_MODEL`, `LOCAL_ANALYSIS_ENABLED=true`, and `ANALYSIS_ENABLED=false`, then restart `npm run dev`. This bypass is honored only by the development server; production still requires Supabase sign-in and an analysis credit. The approved redacted text is still sent to OpenAI, so use sample or otherwise safe-to-share documents while testing.

For browser tests, install the Playwright Chromium binary once with `npx playwright install chromium`, then run `npm run test:e2e`. Playwright builds the production app before starting it, so the suite also verifies the production build path.
