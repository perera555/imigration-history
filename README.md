# Immigration History

A Next.js app for keeping a traveller's **travel identity card** and **previous immigration history**, and downloading both as a polished PDF.

- **Home page**: landing page; **Records** lists every traveller.
- **Traveller page**: travel card (photo, name, age, sex, nationality, passport and up to 10 previous passports, phone, email, address), totals, and the full history grouped by country with flags, visits, dates, duration (years / months / days), purpose and passport used.
- **Download PDF**: card with photo on top, full history table below.
- **Install app**: installable PWA (button at the top of every page).
- **Admin panel** (button at the bottom; sign-in required): add/edit travellers and trips manually, **import from a document** (PDF/photo read automatically with Claude, then reviewed before saving), manage multiple admins, forgot password, remember me.

Tech: Next.js 16 (App Router, Cache Components), PostgreSQL (`postgres`), Tailwind CSS 4, `@react-pdf/renderer`, `jose` sessions, Claude API for document import.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

Tables are created automatically on first request. The first admin is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Optional: load a traveller from a private JSON file (keep it in `data/*.local.json`, which is git-ignored):

```bash
npm run seed -- data/your-file.local.json
```

## Deploy on Vercel

1. Import this GitHub repo in Vercel.
2. **Storage → Create Database → Neon (Postgres)** and connect it to the project (this sets `DATABASE_URL`).
3. Add `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET` (and optionally `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `APP_URL`) under **Settings → Environment Variables**.
4. Deploy. Open `/admin` and sign in.

## Privacy

Traveller pages and PDFs are public to anyone with the link (search engines are blocked with `noindex`). Only the admin panel requires sign-in. Never commit personal data or `.env*` files.
