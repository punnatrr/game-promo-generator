This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## LAZY TOPUP Game Calendar

The previous Game Content entry now opens a verified public event calendar at
`/game-calendar`; bot review and approval live in the main `/admin` dashboard.
Setup, database migrations, Cron schedules, source limitations, API routes, and
testing are documented in [docs/GAME_CALENDAR.md](docs/GAME_CALENDAR.md).

Subscription plans, payment invariants, admin access, and the migration runner
are documented in [docs/SUBSCRIPTION.md](docs/SUBSCRIPTION.md).

## Getting Started

### Reference Roles

Generation is a single-submit workflow with three uploads: game artwork,
product/price reference, and target-shop style. The prompt limits upload 2 to
product data and isolated item icons, and upload 3 to shop design and footer.
There is no separate extraction API or catalog confirmation step.
Prompt constraints cannot guarantee perfect model compliance; inspect outputs.
Run `npm run test:prompt` to check prompt source-role rules.

Create `.env.local` from `.env.example` and add the provider keys you want to use:

```bash
OPENAI_API_KEY="your_openai_api_key"
GEMINI_API_KEY="your_gemini_api_key"
```

The model selector supports only `gpt-image-2` and `gpt-image-3`. OpenAI keys must stay server-side and should be added to Vercel Environment Variables for production.

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
