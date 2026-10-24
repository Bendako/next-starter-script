> [!WARNING]
> **Legacy prototype — not ready for public deployment.** The Express generator
> historically accepted a caller-supplied `userId`, the React generator uses
> a test identity, and the Prisma subscription implementation does not match
> `prisma/schema.prisma`. The Stripe webhook needs a separate schema-aligned,
> idempotent fulfillment implementation.
>
> In this branch, project generation is **disabled by default** and **always
> disabled in production**. To test the old generator locally, run the Express
> server with `NODE_ENV=development ALLOW_UNSAFE_LOCAL_GENERATOR=1` and connect
> from loopback. **Never expose this development override on a public host.**
> Checkout is disabled unless `LEGACY_BILLING_ENABLED=1`; **do not set it**
> before fixing the database mapping and webhook lifecycle. If enabling after
> those fixes, configure server-owned `STRIPE_PRICE_PROFESSIONAL_MONTHLY`,
> `STRIPE_PRICE_TEAM_MONTHLY`, `STRIPE_PRICE_ENTERPRISE_MONTHLY`,
> `STRIPE_SECRET_KEY`, and a trusted `APP_URL`.
>
> API rewrites now proxy only the Express generator/templates/health routes;
> Next.js' own `/api/projects`, `/api/subscription` and `/api/stripe`
> routes are no longer shadowed. The project-record route checks Clerk
> authentication, so the old Express-to-Next POST without a session will
> not record usage until a secure backend-to-backend flow is implemented.
>
> The repository root's MCP server and the newer `hosted/` work are separate
> from this legacy web prototype.

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
