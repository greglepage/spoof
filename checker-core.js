/**
 * Email authentication DNS checker — shared core for spoof demo.
 * Adapted from Network26 DMARC checker.
 */
(function () {
  const DOH_URL = 'https://cloudflare-dns.com/dns-query';

  const DKIM_SELECTORS_BASE = ['default', 'mail', 'dkim', 'mx', 'smtp', 'google'];

  const SPF_DKIM_SELECTORS = [
    { pattern: /google|_spf\.google/i, label: 'Google Workspace', selectors: ['google', '20230601', '20210112', '20161025'] },
    { pattern: /outlook|protection\.outlook|microsoft|spf-a\.outlook/i, label: 'Microsoft 365', selectors: ['selector1', 'selector2'] },
    { pattern: /sendgrid/i, label: 'SendGrid', selectors: ['s1', 's2', 'smtpapi'] },
    { pattern: /mailchimp|mcsv/i, label: 'Mailchimp', selectors: ['k1', 'k2', 'k3'] },
    { pattern: /mandrill/i, label: 'Mandrill', selectors: ['mandrill'] },
    { pattern: /amazonses|ses\.amazonaws/i, label: 'Amazon SES', selectors: ['amazonses', 'selector1', 'selector2'] },
    { pattern: /mailgun/i, label: 'Mailgun', selectors: ['smtp', 'mx', 'k1'] },
    { pattern: /hubspot/i, label: 'HubSpot', selectors: ['hs1', 'hs2'] },
    { pattern: /zendesk/i, label: 'Zendesk', selectors: ['zendesk1', 'zendesk2', 'zd'] },
    { pattern: /constantcontact/i, label: 'Constant Contact', selectors: ['ctct1', 'ctct2'] },
    { pattern: /salesforce|exacttarget/i, label: 'Salesforce', selectors: ['sf1', 'sf2'] },
    { pattern: /sparkpost|messagesystems/i, label: 'SparkPost', selectors: ['scph0120', 'scph0220', 'sparkpost'] },
    { pattern: /brevo|sendinblue/i, label: 'Brevo', selectors: ['brevo', 'sendinblue'] },
    { pattern: /zoho/i, label: 'Zoho Mail', selectors: ['zoho', 'zmail'] },
    { pattern: /protonmail/i, label: 'Proton Mail', selectors: ['protonmail', 'protonmail2', 'protonmail3'] },
    { pattern: /mimecast/i, label: 'Mimecast', selectors: ['mimecast', 'mc'] },
    { pattern: /proofpoint|pphosted/i, label: 'Proofpoint', selectors: ['proofpoint', 'pp'] },
    { pattern: /intercom/i, label: 'Intercom', selectors: ['intercom', 'ic'] },
    { pattern: /freshdesk|freshworks/i, label: 'Freshdesk', selectors: ['freshdesk', 'fd'] },
    { pattern: /shopify/i, label: 'Shopify', selectors: ['shopify', 'smtp'] },
    { pattern: /squarespace/i, label: 'Squarespace', selectors: ['squarespace'] },
    { pattern: /secureserver|godaddy/i, label: 'GoDaddy', selectors: ['secureserver1', 'secureserver2', 'default'] },
    { pattern: /wpcom|wordpress/i, label: 'WordPress.com', selectors: ['wpcom', 'wordpress'] },
  ];

  function sanitizeDomain(input) {
    let d = input.trim().toLowerCase();
    d = d.replace(/^https?:\/\//, '').replace(/^www\./, '');
    d = d.split('/')[0].split('?')[0].split('#')[0].replace(/@/g, '');
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return null;
    return d;
  }

  function parseTxtAnswerData(data) {
    let text = data.trim();
    if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
    return text.replace(/"\s+"/g, '').replace(/\\"/g, '"');
  }

  function parseTxtAnswers(answers) {
    return (answers || []).filter((a) => a.type === 16).map((a) => parseTxtAnswerData(a.data));
  }

  async function dnsQuery(name, type) {
    const url = `${DOH_URL}?name=${encodeURIComponent(name)}&type=${type}`;
    const res = await fetch(url, { headers: { Accept: 'application/dns-json' } });
    if (!res.ok) throw new Error('DNS lookup failed');
    const data = await res.json();
    if (data.Status !== 0 && !data.Answer?.length) return [];
    return parseTxtAnswers(data.Answer);
  }

  async function dnsQueryTxtFollowCname(name, depth = 0) {
    if (depth > 6) return [];
    const url = `${DOH_URL}?name=${encodeURIComponent(name)}&type=TXT`;
    const res = await fetch(url, { headers: { Accept: 'application/dns-json' } });
    if (!res.ok) throw new Error('DNS lookup failed');
    const data = await res.json();
    const answers = data.Answer || [];
    const txt = parseTxtAnswers(answers);
    if (txt.length) return txt;
    const cname = answers.find((a) => a.type === 5);
    if (cname) return dnsQueryTxtFollowCname(cname.data.replace(/\.$/, ''), depth + 1);
    return [];
  }

  function parseDmarc(records) {
    const raw = records.find((r) => /^v=DMARC1/i.test(r));
    if (!raw) return null;
    const tags = {};
    raw.split(';').forEach((part) => {
      const [key, ...rest] = part.trim().split('=');
      if (key) tags[key.trim().toLowerCase()] = rest.join('=').trim();
    });
    return { raw, tags };
  }

  function parseSpf(records) {
    const raw = records.find((r) => /^v=spf1/i.test(r));
    if (!raw) return null;
    const parts = raw.replace(/^v=spf1\s*/i, '').split(/\s+/).filter(Boolean);
    const mechanisms = parts.map((p) => {
      const match = p.match(/^([+~\-?]?)(ip[46]:[^\s]+|all|[a-z]+(?::[^\s]+)?)/i);
      if (!match) return { raw: p, qualifier: '+', mechanism: p, target: '' };
      const qualifier = match[1] || '+';
      const full = match[2];
      const colon = full.indexOf(':');
      if (colon > -1) return { raw: p, qualifier, mechanism: full.slice(0, colon), target: full.slice(colon + 1) };
      return { raw: p, qualifier, mechanism: full, target: '' };
    });
    return { raw, mechanisms };
  }

  function countSpfLookups(spf) {
    if (!spf) return 0;
    return spf.mechanisms.filter((m) =>
      ['include', 'a', 'mx', 'ptr', 'exists', 'redirect'].includes(m.mechanism.toLowerCase())
    ).length;
  }

  function buildDkimProbeList(spf) {
    const probes = new Map();
    DKIM_SELECTORS_BASE.forEach((s) => probes.set(s, { selector: s, sources: ['common'] }));
    if (spf) {
      spf.mechanisms.forEach((m) => {
        const mech = m.mechanism.toLowerCase();
        if (!m.target || (mech !== 'include' && mech !== 'redirect')) return;
        SPF_DKIM_SELECTORS.forEach((entry) => {
          if (!entry.pattern.test(m.target)) return;
          entry.selectors.forEach((selector) => {
            const existing = probes.get(selector);
            if (existing) {
              if (!existing.sources.includes(entry.label)) existing.sources.push(entry.label);
            } else {
              probes.set(selector, { selector, sources: [entry.label] });
            }
          });
        });
      });
    }
    return Array.from(probes.values());
  }

  function isDkimRecordValid(record) {
    if (!/v=DKIM1|dkim1/i.test(record) && !/k=rsa/i.test(record)) return false;
    const keyMatch = record.match(/p=([A-Za-z0-9+/=]+)/i);
    return Boolean(keyMatch && keyMatch[1].length >= 20);
  }

  async function checkDkimSelectors(domain, probeList) {
    return Promise.all(
      probeList.map(({ selector, sources }) =>
        dnsQueryTxtFollowCname(`${selector}._domainkey.${domain}`).then((records) => ({
          selector,
          sources,
          found: records.some((r) => isDkimRecordValid(r)),
          records,
        }))
      )
    );
  }

  function assessStatus(dmarc, spf, dkimResults) {
    const issues = [];
    const dkimFound = dkimResults.some((d) => d.found);
    const policy = dmarc?.tags?.p?.toLowerCase() || null;

    if (!dmarc) issues.push('no-dmarc');
    else if (policy === 'none') issues.push('dmarc-none');

    if (!spf) issues.push('no-spf');
    else {
      const allMech = spf.mechanisms.find((m) => m.mechanism.toLowerCase() === 'all');
      if (!allMech) issues.push('spf-no-all');
      else if (allMech.qualifier === '+') issues.push('spf-allow-all');
      else if (allMech.qualifier === '~') issues.push('spf-softfail');
      if (countSpfLookups(spf) > 10) issues.push('spf-too-many');
    }

    if (!dkimFound) issues.push('no-dkim');

    const hasEnforcedDmarc = policy === 'quarantine' || policy === 'reject';
    const hasCriticalGap = issues.includes('no-dmarc') || issues.includes('no-spf') || issues.includes('spf-allow-all');

    let level = 'protected';
    if (hasCriticalGap) level = 'at-risk';
    else if (issues.includes('dmarc-none') || !hasEnforcedDmarc) level = 'monitoring';

    return { level, issues, policy, dkimFound };
  }

  function assessSpoofRisk(dmarc, spf, dkimResults, status) {
    const policy = dmarc?.tags?.p?.toLowerCase() || null;
    const issues = status.issues;

    let exposure = 'exposed';
    let headline = 'This email could land in your employees\' inboxes.';
    let explanation = 'We checked your domain\'s email protection. Based on what\'s missing below, inbox providers may deliver spoofed messages that look exactly like the preview.';
    let deliveryLikelihood = 'high';

    const hasEnforcedDmarc = policy === 'quarantine' || policy === 'reject';
    const hasCriticalGap = issues.includes('no-dmarc') || issues.includes('no-spf') || issues.includes('spf-allow-all');

    if (hasCriticalGap || issues.includes('dmarc-none')) {
      exposure = 'exposed';
      deliveryLikelihood = 'high';
      if (issues.includes('no-dmarc') && issues.includes('no-spf')) {
        headline = 'Your team could receive emails exactly like this.';
        explanation = 'Your domain has no email protection telling inbox providers to block impersonation. Attackers don\'t need access to your systems. They just forge your address and send.';
      } else if (issues.includes('dmarc-none')) {
        headline = 'Spoofed emails still reach inboxes — you\'re only monitoring.';
        explanation = 'Your protection is set to monitor, not block. Messages like the one below can reach inboxes today. The preview shows what your employees would see.';
      }
    } else if (!hasEnforcedDmarc || issues.includes('no-dkim') || (issues.includes('spf-softfail') && !hasEnforcedDmarc)) {
      exposure = 'partial';
      deliveryLikelihood = 'medium';
      headline = 'Some providers may deliver this. Others might not.';
      explanation = 'You have partial protection, but spoofed mail can still slip through at less strict inbox providers. It only takes one employee acting on a message like this.';
    } else if (policy === 'reject') {
      exposure = 'blocked';
      deliveryLikelihood = 'low';
      headline = 'Spoofed mail should never be delivered.';
      explanation = 'Your DMARC reject policy tells providers to refuse spoofed mail at the gateway. The preview below shows what attackers still try — and that it should never reach any folder.';
      if (issues.includes('spf-softfail')) {
        explanation += ' Your SPF uses ~all; tightening to -all is still recommended, but spoofed mail should still be refused.';
      }
    } else if (policy === 'quarantine') {
      exposure = 'junk';
      deliveryLikelihood = 'low';
      headline = 'Spoofed mail should land in Junk, not the inbox.';
      explanation = 'Your DMARC quarantine policy tells providers to route failed authentication to Junk. The preview below shows what that looks like if someone opens their spam folder.';
      if (issues.includes('spf-softfail')) {
        explanation += ' Your SPF uses ~all; tightening to -all is still recommended.';
      }
    }

    const deliveryOutcome = exposure === 'junk' ? 'junk' : exposure === 'blocked' ? 'blocked' : 'inbox';

    return {
      exposure,
      deliveryOutcome,
      risk: exposure === 'exposed' ? 'high' : exposure === 'partial' ? 'medium' : 'low',
      headline,
      explanation,
      deliveryLikelihood,
      spoofFrom: `ceo@${status.domain || 'yourdomain.com'}`,
      spoofDisplayName: 'CEO',
    };
  }

  async function checkDomain(domain, onProgress) {
    onProgress?.(0);
    const dmarcRecords = await dnsQuery(`_dmarc.${domain}`, 'TXT');
    onProgress?.(1);
    const spfRecords = await dnsQuery(domain, 'TXT');
    const dmarc = parseDmarc(dmarcRecords);
    const spf = parseSpf(spfRecords);
    const dkimProbeList = buildDkimProbeList(spf);
    onProgress?.(2);
    const dkimResults = await checkDkimSelectors(domain, dkimProbeList);
    onProgress?.(3);
    const status = assessStatus(dmarc, spf, dkimResults);
    status.domain = domain;
    const spoofRisk = assessSpoofRisk(dmarc, spf, dkimResults, status);
    spoofRisk.spoofFrom = `ceo@${domain}`;
    return { domain, dmarc, spf, dkimResults, status, spoofRisk };
  }

  window.EmailAuthChecker = {
    sanitizeDomain,
    checkDomain,
    assessStatus,
    assessSpoofRisk,
  };
})();