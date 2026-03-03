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

## Realtime Tracking Env

- `NEXT_PUBLIC_API_BASE_URL` for REST endpoints.
- `NEXT_PUBLIC_SOCKET_URL` for Socket.IO host/origin (recommended in production).
- `NEXT_PUBLIC_SOCKET_PATH` for Socket.IO path (default: `/socket.io`).

Example:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/v1
NEXT_PUBLIC_SOCKET_URL=https://api.example.com
NEXT_PUBLIC_SOCKET_PATH=/socket.io
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Testing

Production-grade testing has been configured with unit, integration, E2E,
security, and performance smoke checks.

### Scripts

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:coverage` (enforces 70% thresholds)
- `pnpm test:e2e`
- `pnpm test:security`
- `pnpm test:perf:smoke`

### E2E Notes

- Playwright runs against staging using `E2E_BASE_URL`.
- Optional deterministic seed/reset is supported via backend:
  - `POST /internal/test/reset`
  - `POST /internal/test/seed`
- Seed routes require `TEST_ADMIN_TOKEN` header and
  `ENABLE_TEST_ADMIN_ROUTES=true` on backend.
