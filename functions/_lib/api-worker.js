/**
 * Cloudflare Worker — sends safe spoofing demo emails via Resend or Mailgun.
 *
 * Required secrets (wrangler secret put):
 *   RESEND_API_KEY  — OR —
 *   MAILGUN_API_KEY + MAILGUN_DOMAIN
 *
 * Optional:
 *   ENVELOPE_FROM   — verified sending address (default: demo@mail.network26.com)
 *   ALLOWED_ORIGINS — comma-separated CORS origins
 */

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function corsHeaders(origin, allowedOrigins) {
  const allowed = (allowedOrigins || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (!allowed.length) {
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function sanitizeDomain(input) {
  if (!input || typeof input !== 'string') return null;
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '');
  d = d.split('/')[0].split('?')[0].replace(/@/g, '');
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return null;
  return d;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.length <= 254;
}

function buildDemoEmailHtml({ domain, spoofFrom, displayName, risk }) {
  const riskNote = {
    high: 'Because your domain lacks strong email authentication, this message may arrive in your inbox looking completely legitimate.',
    medium: 'Your partial protection means this message might arrive in your inbox or spam folder.',
    low: 'Your strong DMARC policy means this message was likely blocked or flagged — which is exactly what should happen.',
  }[risk] || 'This demonstrates how email spoofing works.';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
    <strong style="color: #92400e;">⚠️ SECURITY DEMO — NOT A REAL REQUEST</strong>
    <p style="margin: 8px 0 0; color: #78350f; font-size: 14px;">
      This email was sent by <a href="https://spoof.network26.com" style="color: #0d9488;">Network26 Spoof Demo</a>
      to demonstrate email impersonation risk for <strong>${domain}</strong>.
      It is safe — no links to click, no attachments, no action required.
    </p>
  </div>

  <p>Hi,</p>
  <p>Please review and process the attached invoice at your earliest convenience. This needs to go out today.</p>
  <p>Let me know once it's done.</p>
  <p>Thanks,<br>${displayName}</p>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">

  <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 16px; font-size: 14px;">
    <strong style="color: #0f766e;">What just happened?</strong>
    <p style="margin: 8px 0 0; color: #134e4a;">
      This email was sent with <code>From: ${spoofFrom}</code> — but it did NOT come from your mail servers.
      ${riskNote}
    </p>
    <p style="margin: 12px 0 0;">
      <a href="https://dmarc.network26.com/?domain=${encodeURIComponent(domain)}" style="color: #0d9488; font-weight: 600;">Check your DMARC records →</a>
      &nbsp;·&nbsp;
      <a href="https://network26.com/#contact" style="color: #0d9488; font-weight: 600;">Get help from Network26 →</a>
    </p>
  </div>

  <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">
    Sent by Network26 · 425-368-9526 · hello@network26.com<br>
    Educational spoofing demonstration — you consented to receive this message.
  </p>
</body>
</html>`;
}

async function sendViaResend(env, { to, spoofFrom, displayName, domain, risk }) {
  const envelopeFrom = env.ENVELOPE_FROM || 'Spoof Demo <demo@mail.network26.com>';
  const subject = `[DEMO] Urgent: Please review attached invoice — ${domain}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: envelopeFrom,
      to: [to],
      subject,
      html: buildDemoEmailHtml({ domain, spoofFrom, displayName, risk }),
      reply_to: 'hello@network26.com',
      headers: {
        'X-Demo-Type': 'spoof-education',
        'X-Demo-Domain': domain,
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `Resend error (${res.status})`);
  }
  return data;
}

async function sendViaMailgun(env, { to, spoofFrom, displayName, domain, risk }) {
  const mgDomain = env.MAILGUN_DOMAIN;
  const subject = `[DEMO] Urgent: Please review attached invoice — ${domain}`;
  const fromHeader = `${displayName} <${spoofFrom}>`;

  const form = new FormData();
  form.append('from', fromHeader);
  form.append('to', to);
  form.append('subject', subject);
  form.append('html', buildDemoEmailHtml({ domain, spoofFrom, displayName, risk }));
  form.append('h:Reply-To', 'hello@network26.com');
  form.append('o:tag', 'spoof-demo');
  form.append('h:X-Demo-Type', 'spoof-education');

  const res = await fetch(`https://api.mailgun.net/v3/${mgDomain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}`,
    },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Mailgun error (${res.status})`);
  }
  return data;
}

async function checkRateLimit(kv, ip) {
  if (!kv || !ip) return true;
  const key = `rate:${ip}`;
  const now = Date.now();
  const raw = await kv.get(key);
  let entries = raw ? JSON.parse(raw) : [];
  entries = entries.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (entries.length >= RATE_LIMIT_MAX) return false;
  entries.push(now);
  await kv.put(key, JSON.stringify(entries), { expirationTtl: 3600 });
  return true;
}

async function handleSendDemo(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { domain: rawDomain, to, spoofFrom: rawFrom, displayName, consent, risk } = body;

  if (!consent) {
    return jsonResponse({ error: 'Consent is required to send a demo email.' }, 400);
  }

  const domain = sanitizeDomain(rawDomain);
  if (!domain) {
    return jsonResponse({ error: 'Invalid domain.' }, 400);
  }

  if (!isValidEmail(to)) {
    return jsonResponse({ error: 'Invalid recipient email address.' }, 400);
  }

  const spoofFrom = typeof rawFrom === 'string' && rawFrom.includes('@')
    ? rawFrom.trim().toLowerCase()
    : `ceo@${domain}`;

  if (!spoofFrom.endsWith(`@${domain}`)) {
    return jsonResponse({ error: 'Spoof address must use the tested domain.' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const allowed = await checkRateLimit(env.RATE_LIMIT, ip);
  if (!allowed) {
    return jsonResponse({ error: 'Rate limit exceeded. Try again in an hour.' }, 429);
  }

  const hasResend = Boolean(env.RESEND_API_KEY);
  const hasMailgun = Boolean(env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN);

  if (!hasResend && !hasMailgun) {
    return jsonResponse({ error: 'Email service not configured. Contact Network26.' }, 503);
  }

  const payload = {
    to: to.trim(),
    spoofFrom,
    displayName: displayName || 'CEO',
    domain,
    risk: risk || 'high',
  };

  try {
    if (hasMailgun) {
      await sendViaMailgun(env, payload);
    } else {
      await sendViaResend(env, payload);
    }
  } catch (err) {
    console.error('Send failed:', err);
    return jsonResponse({ error: err.message || 'Failed to send demo email.' }, 502);
  }

  return jsonResponse({
    ok: true,
    message: `Demo email sent to ${to}. Check your inbox and spam folder — delivery depends on your domain's authentication settings.`,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/api/send-demo' || url.pathname === '/send-demo') {
      if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405, cors);
      }
      const response = await handleSendDemo(request, env);
      Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    }

    if (url.pathname === '/api/health' || url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        resend: Boolean(env.RESEND_API_KEY),
        mailgun: Boolean(env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN),
      }, 200, cors);
    }

    return jsonResponse({ error: 'Not found' }, 404, cors);
  },
};