# Network26 Spoof Demo

Educational email spoofing awareness tool for [spoof.network26.com](https://spoof.network26.com). Visitors enter a domain, see a realistic Outlook-style preview of what a spoofed message could look like, and can optionally send themselves a safe demo email.

## Stack

- Static site (`index.html`, `spoof-demo.js`, `checker-core.js`) on Cloudflare Pages
- API via Pages Functions (`functions/api/`) backed by `worker/src/index.js`
- Email delivery through Resend or Mailgun

## Local development

```bash
npm install
npm run dev
```

Opens at http://localhost:3456.

## Deploy

```bash
npm run deploy
```

Set Pages secrets before sending demo emails:

```bash
npx wrangler pages secret put RESEND_API_KEY --project-name=spoof-demo
# or
npx wrangler pages secret put MAILGUN_API_KEY --project-name=spoof-demo
npx wrangler pages secret put MAILGUN_DOMAIN --project-name=spoof-demo
```

Optional: `ALLOWED_ORIGINS` for CORS restriction.

## Project layout

| Path | Purpose |
|------|---------|
| `index.html` | Landing page and Outlook preview UI |
| `spoof-demo.js` | Client-side demo flow |
| `checker-core.js` | DNS/SPF/DKIM/DMARC checks |
| `worker/src/index.js` | Demo email API |
| `functions/api/[[path]].js` | Pages Function adapter |