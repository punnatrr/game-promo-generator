# Game Promo Generator - Agent Notes

This repository is the main local project for the Game Promo Generator website.

## Project Identity

- Vercel project: `game-promo-generator-tuh8`
- Vercel project ID: `prj_zlmqLAa3viFJO7gR0bYByNEfWVO7`
- Vercel team slug: `punnatee2546-8693s-projects`
- Vercel team ID: `team_17sw5jOGRqLWr3tR9xA4y3LF`
- GitHub repository: `punnatrr/game-promo-generator`
- Production domain: `game-promo-generator-tuh8.vercel.app`
- Framework: Next.js App Router
- Vercel Node.js version: 24.x

## Structure

- `app/` - App Router pages, layouts, UI components, and route handlers.
- `app/page.tsx` - Main promo generator UI: uploads three reference images, selects aspect ratio/model/quality/result count, generates posters, refines the latest result, and stores local browser history.
- `app/components/ui/` - Reusable form and feedback UI components.
- `app/api/` - API routes for generation, auth, subscriptions, plans, payments, admin payment review, and history.
- `lib/` - Server-side helpers for auth, database access, prompts, payments, generations, subscriptions, and quotas.
- `db/` - SQL schema and seed data for subscription plans.
- `public/` - Static assets.
- `production-recovery/` - Recovery snapshot of production source. Do not edit unless specifically asked.
- `.vercel/project.json` - Local Vercel project link. It should point to the project/team above.

## Package Manager And Commands

Use npm. On this Windows machine, prefer `npm.cmd` because PowerShell blocks `npm.ps1`.

- Install dependencies: `npm.cmd install`
- Dev server: `npm.cmd run dev`
- Lint: `npm.cmd run lint`
- Typecheck: `npm.cmd exec -- tsc --noEmit`
- Build: `npm.cmd run build`
- Start built app: `npm.cmd run start`

There is currently no `test` script in `package.json`.

## Environment

- `.env.local` is ignored by git and must never be committed or printed in chat.
- `.env.example` is the only env file intended for source control.
- Use Vercel CLI to pull development env when needed:

```bash
npx.cmd --yes vercel@latest pull --yes --environment=development --scope punnatee2546-8693s-projects
```

If `.env.local` already exists, do not overwrite it unless the user explicitly approves that overwrite. Newer Vercel CLI versions may place pulled env in `.vercel/.env.development.local`.

## Editing Rules

- Read related files before making changes.
- Keep local uncommitted files as the source of truth.
- Do not run `git reset`, `git checkout`, destructive deletes, or overwrite local uncommitted work unless the user explicitly asks.
- Make the smallest change that satisfies the request.
- Preserve existing UI, behavior, routes, and data unless the user asks to change them.
- Check the diff after edits.
- Run supported verification after edits: lint, typecheck, build, and a local page check.
- Do not reveal API keys, database URLs, cookies, tokens, or env values.

## Local Verification

Recommended flow after code edits:

```bash
npm.cmd run lint
npm.cmd exec -- tsc --noEmit
npm.cmd run build
npm.cmd run dev
```

Then open `http://localhost:3000` and verify the affected route. The home page should render the `LAZY-AI.GAME` generator UI.

## Vercel Deployment

- Preview deployment is allowed only when useful for verification or when the user asks.
- Production deployment is forbidden unless the user clearly says: `Deploy ขึ้น Production`.
- Before deployment, confirm the linked Vercel project is still `game-promo-generator-tuh8`.
- Use explicit team scope for Vercel CLI commands:

```bash
npx.cmd --yes vercel@latest --scope punnatee2546-8693s-projects
```

For production deploys, use the exact project/team above and only after explicit user approval.
