(function () {
  const LOADING_STEPS = [
    'Checking if spoofing is possible',
    'Building your email preview',
  ];

  const SCENARIOS = {
    invoice: {
      label: 'Fake invoice',
      displayName: 'CEO',
      localPart: 'ceo',
      subject: 'Urgent: Please review attached invoice',
      preview: 'Hi team, please process the attached invoice today. Let me know once complete. Thanks.',
      body: [
        'Hi,',
        'Please process the attached invoice today.',
      ],
      attachment: (domain) => `Invoice_${domain}_Q1.pdf`,
      attachmentSize: '248 KB',
    },
    wire: {
      label: 'Wire transfer',
      displayName: 'CFO',
      localPart: 'cfo',
      subject: 'CONFIDENTIAL: Wire transfer instructions',
      preview: 'Need you to handle a time-sensitive wire today. Details in the attached PDF. Do not call, I\'m in meetings.',
      body: [
        'Hi,',
        'Please handle the urgent wire in the attached PDF before end of day. I\'m in meetings and can\'t take calls.',
      ],
      attachment: (domain) => `Wire_Instructions_${domain}.pdf`,
      attachmentSize: '186 KB',
    },
    it: {
      label: 'IT password reset',
      displayName: 'IT Support',
      localPart: 'it',
      subject: 'Action required: Password expires today',
      preview: 'Your company password expires in 2 hours. Use the link below to reset it now or you\'ll be locked out.',
      body: [
        'Hi,',
        'Your password expires today. Reset it now using the link below to avoid being locked out.',
      ],
      attachment: null,
      fakeLink: 'https://secure-login.example.com/reset',
    },
    customer: {
      label: 'Email your customers',
      audience: 'customer',
      displayName: 'Customer Support',
      localPart: 'support',
      subject: 'Important: Action needed on your account',
      preview: 'We need you to confirm your account details to keep your service active. Please use the link below today.',
      body: [
        'Dear valued customer,',
        'Please confirm your account details using the link below to avoid a service interruption.',
      ],
      attachment: null,
      fakeLink: 'https://account.example.com/verify',
    },
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getScenario(key) {
    return SCENARIOS[key] || SCENARIOS.invoice;
  }

  function getDeliveryOutcome(data) {
    const { spoofRisk, dmarc } = data;
    if (spoofRisk?.deliveryOutcome) return spoofRisk.deliveryOutcome;

    const exposure = spoofRisk?.exposure || spoofRisk?.risk || 'partial';
    if (exposure === 'junk' || exposure === 'blocked') return exposure;

    const policy = dmarc?.tags?.p?.toLowerCase() || null;
    if (exposure === 'protected' || spoofRisk?.risk === 'low') {
      return policy === 'reject' ? 'blocked' : 'junk';
    }
    return 'inbox';
  }

  function getTechnicalWhy(data, exposure) {
    const level = normalizeExposure(exposure);
    const issues = data.status?.issues || [];
    const policy = data.dmarc?.tags?.p?.toLowerCase() || null;
    const dkimFound = data.dkimResults?.some((d) => d.found);

    if (level === 'exposed') {
      if (issues.includes('no-dmarc') && issues.includes('no-spf')) {
        return 'Your domain has no DMARC or SPF records, so inbox providers are not told to block mail from unauthorized servers.';
      }
      if (issues.includes('no-dmarc')) {
        return 'Without a DMARC policy, providers have no instruction to block spoofed mail that fails authentication.';
      }
      if (issues.includes('dmarc-none')) {
        return 'Your DMARC policy is monitor-only (p=none), so providers log failures but do not block messages like this.';
      }
      if (issues.includes('no-spf')) {
        return 'Without SPF, providers cannot verify which servers are allowed to send for your domain.';
      }
      if (issues.includes('spf-allow-all')) {
        return 'Your SPF record allows any server to pass (+all), so spoofed mail can look legitimate to many providers.';
      }
      return 'Your DNS does not tell inbox providers to block unauthorized senders, so messages like this can reach inboxes.';
    }

    if (level === 'partial') {
      const reasons = [];
      if (issues.includes('spf-softfail')) {
        reasons.push('your SPF uses ~all, which can let unverified senders through');
      }
      if (!dkimFound) {
        reasons.push('no DKIM signing keys were found for your domain');
      }
      if (!reasons.length && policy !== 'quarantine' && policy !== 'reject') {
        reasons.push('your DMARC policy does not require providers to block or quarantine failures');
      }

      if (reasons.length === 1) {
        return `Because ${reasons[0]}, some inbox providers may still deliver messages like this.`;
      }
      if (reasons.length === 2) {
        return `Because ${reasons[0]} and ${reasons[1]}, some inbox providers may still deliver messages like this.`;
      }
      return 'Your DNS gives providers mixed signals about spoofed mail, so some may still deliver messages like this.';
    }

    if (level === 'blocked' || policy === 'reject') {
      let msg = 'Your DMARC reject policy tells major providers to refuse spoofed mail before delivery, though attackers still send messages like this.';
      if (issues.includes('spf-softfail')) {
        msg += ' Your SPF uses ~all; consider switching to -all for a harder fail.';
      }
      return msg;
    }
    if (level === 'junk' || policy === 'quarantine') {
      let msg = 'Your DMARC quarantine policy tells major providers to route spoofed mail to Junk instead of the inbox, though attackers still send messages like this.';
      if (issues.includes('spf-softfail')) {
        msg += ' Your SPF uses ~all; consider switching to -all for a harder fail.';
      }
      return msg;
    }
    return 'Your DNS gives providers mixed signals about spoofed mail, so some may still deliver messages like this.';
  }

  function getScenarioWhyItWorks(scenarioKey, data) {
    const exposure = data.spoofRisk?.exposure || data.spoofRisk?.risk || 'partial';
    const social = {
      invoice: 'Trusted CEO name, your real domain, PDF attached. Urgent invoices often get paid without a call.',
      wire: 'It looks like your CFO and says they cannot take calls. Staff often approve wires before anyone verifies by phone.',
      it: 'IT lockout fear pushes people to click reset links before checking with real support.',
      customer: 'Customers trust mail from your domain. An urgent account notice feels official, so people click or reply before calling you.',
    };

    return {
      social: social[scenarioKey] || social.invoice,
      technical: getTechnicalWhy(data, exposure),
    };
  }

  function buildSpoofAddress(domain, scenario) {
    return `${scenario.localPart}@${domain}`;
  }

  function normalizeExposure(exposureOrRisk) {
    const map = {
      exposed: 'exposed',
      partial: 'partial',
      junk: 'junk',
      blocked: 'blocked',
      protected: 'blocked',
      high: 'exposed',
      medium: 'partial',
      low: 'blocked',
    };
    return map[exposureOrRisk] || 'partial';
  }

  function deliveryBadge(exposure) {
    const map = {
      exposed: {
        bg: 'bg-red-50 border-red-200',
        dot: 'bg-red-500',
        label: 'Likely to deliver',
        labelColor: 'text-red-700',
      },
      partial: {
        bg: 'bg-amber-50 border-amber-200',
        dot: 'bg-amber-500',
        label: 'May deliver',
        labelColor: 'text-amber-700',
      },
      junk: {
        bg: 'bg-amber-50 border-amber-200',
        dot: 'bg-amber-500',
        label: 'Likely junked',
        labelColor: 'text-amber-800',
      },
      blocked: {
        bg: 'bg-teal-50 border-teal-200',
        dot: 'bg-teal-500',
        label: 'Likely blocked',
        labelColor: 'text-teal-700',
      },
    };
    return map[exposure] || map.partial;
  }

  function previewCaption(deliveryOutcome) {
    const map = {
      inbox: 'Simulated Outlook inbox, for illustration only',
      junk: 'Simulated Junk folder — not the inbox',
      blocked: 'Simulated blocked delivery — message never arrives',
    };
    return map[deliveryOutcome] || map.inbox;
  }

  function getAuthRecordStatuses(data) {
    const { dmarc, status, dkimResults } = data;
    const issues = status?.issues || [];
    const policy = dmarc?.tags?.p?.toLowerCase() || null;
    const dkimFound = dkimResults?.some((d) => d.found);

    const records = [];

    if (issues.includes('no-dmarc')) {
      records.push({ name: 'DMARC', state: 'missing', label: 'Missing', detail: 'No policy telling inboxes to block spoofed mail' });
    } else if (issues.includes('dmarc-none')) {
      records.push({ name: 'DMARC', state: 'warn', label: 'Monitor only', detail: 'Policy is p=none, so failed mail is not blocked' });
    } else if (policy === 'quarantine') {
      records.push({ name: 'DMARC', state: 'ok', label: 'Quarantine', detail: 'Failed spoof attempts should land in junk' });
    } else if (policy === 'reject') {
      records.push({ name: 'DMARC', state: 'ok', label: 'Reject', detail: 'Failed spoof attempts should be blocked' });
    } else {
      records.push({ name: 'DMARC', state: 'warn', label: 'Needs review', detail: 'DMARC found but may not fully block spoofing' });
    }

    if (issues.includes('no-spf')) {
      records.push({ name: 'SPF', state: 'missing', label: 'Missing', detail: 'No sender list for your domain' });
    } else if (issues.includes('spf-allow-all')) {
      records.push({ name: 'SPF', state: 'missing', label: 'Allows anyone', detail: '+all lets any server pass SPF checks' });
    } else if (issues.includes('spf-softfail')) {
      const enforcedDmarc = policy === 'quarantine' || policy === 'reject';
      records.push({
        name: 'SPF',
        state: 'warn',
        label: 'Soft fail',
        detail: enforcedDmarc
          ? '~all is weaker than -all; tighten when you can'
          : '~all may still allow spoofed mail through',
      });
    } else {
      records.push({ name: 'SPF', state: 'ok', label: 'Configured', detail: 'Sender list found in DNS' });
    }

    if (!dkimFound) {
      records.push({ name: 'DKIM', state: 'warn', label: 'Not found', detail: 'No signing keys detected in DNS' });
    } else {
      records.push({ name: 'DKIM', state: 'ok', label: 'Found', detail: 'Email signing keys detected' });
    }

    return records;
  }

  function recordStateStyles(state) {
    const map = {
      missing: {
        chip: 'bg-red-100 text-red-800 border-red-200',
        card: 'bg-white/70 border-red-100',
        label: 'text-red-800',
      },
      warn: {
        chip: 'bg-amber-100 text-amber-800 border-amber-200',
        card: 'bg-white/70 border-amber-100',
        label: 'text-amber-800',
      },
      ok: {
        chip: 'bg-teal-100 text-teal-800 border-teal-200',
        card: 'bg-white/70 border-teal-100',
        label: 'text-teal-800',
      },
    };
    return map[state] || map.warn;
  }

  function renderCompactRecordTiles(data) {
    const records = getAuthRecordStatuses(data);

    return `
      <div class="mt-3 pt-3 border-t border-black/5">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center mb-2.5">What we found</div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl mx-auto">
          ${records.map((record) => {
            const styles = recordStateStyles(record.state);
            return `
              <div class="rounded-xl border ${styles.card} p-3 min-w-0">
                <div class="flex items-center justify-between gap-2 mb-1">
                  <span class="text-xs font-bold tracking-wide text-slate-700">${escapeHtml(record.name)}</span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${styles.chip}">${escapeHtml(record.label)}</span>
                </div>
                <p class="text-xs text-slate-600 leading-snug m-0">${escapeHtml(record.detail)}</p>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function renderDeliveryOutlookTile(data) {
    const { domain, spoofRisk } = data;
    const exposure = normalizeExposure(spoofRisk.exposure || spoofRisk.risk || 'partial');
    const badge = deliveryBadge(exposure);

    return `
      <div id="delivery-outlook" class="rounded-2xl border ${badge.bg} px-4 py-3.5 sm:px-5 sm:py-4 mb-4 sm:mb-5 max-w-3xl mx-auto scroll-mt-[4.5rem] sm:scroll-mt-20">
        <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mb-2">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-2 h-2 rounded-full ${badge.dot} shrink-0"></div>
            <span class="text-[11px] font-bold uppercase tracking-wider ${badge.labelColor}">What would actually happen</span>
          </div>
          <span class="text-xs text-slate-600">for <span class="font-bold text-slate-900">${escapeHtml(domain)}</span></span>
          <span class="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold ${badge.labelColor} ${badge.bg} sm:ml-auto shrink-0">${escapeHtml(badge.label)}</span>
        </div>

        <p class="text-base sm:text-lg font-bold text-slate-900 leading-snug m-0">${escapeHtml(spoofRisk.headline || 'This email could land in your employees\' inboxes.')}</p>
        <p class="text-sm text-slate-600 mt-1.5 leading-snug m-0">${escapeHtml(spoofRisk.explanation || '')}</p>

        ${renderCompactRecordTiles(data)}
      </div>`;
  }

  function isCustomerScenario(scenario) {
    return scenario.audience === 'customer';
  }

  function buildScenarioMessageParts(domain, scenario) {
    const attachmentHtml = scenario.attachment
      ? `<div class="mt-4 flex items-center gap-2.5 p-2.5 rounded border border-[#edebe9] bg-[#faf9f8] max-w-xs">
           <div class="w-8 h-8 rounded bg-[#d13438] text-white flex items-center justify-center text-[10px] font-bold shrink-0">PDF</div>
           <div class="min-w-0">
             <div class="text-xs font-medium text-[#323130] truncate">${escapeHtml(scenario.attachment(domain))}</div>
             <div class="text-[10px] text-[#605e5c]">${escapeHtml(scenario.attachmentSize || '')}</div>
           </div>
         </div>`
      : '';

    const linkHtml = scenario.fakeLink
      ? `<p class="mt-3"><a href="#" class="text-[#0078d4] underline" onclick="return false">${escapeHtml(scenario.fakeLink)}</a></p>
         <p class="text-[10px] text-[#a19f9d] m-0">Fake link (would redirect to a credential-stealing page)</p>`
      : '';

    const bodyHtml = scenario.body.map((p) => `<p class="m-0 mb-3">${escapeHtml(p)}</p>`).join('');

    return { attachmentHtml, linkHtml, bodyHtml };
  }

  function renderOutlookChrome(folderLabel, folderTone = 'inbox') {
    const headerClass = folderTone === 'junk'
      ? 'bg-[#5c2d91]'
      : 'bg-[#0078d4]';

    return `
      <div class="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 ${headerClass} text-white shrink-0">
        <div class="flex items-center gap-1.5 shrink-0">
          <svg class="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z"/></svg>
          <span class="text-xs sm:text-sm font-semibold">Outlook</span>
        </div>
        <div class="flex-1 text-center text-[10px] sm:text-xs text-white/80 truncate">${escapeHtml(folderLabel)}</div>
      </div>`;
  }

  function renderMessageHeader(domain, scenario) {
    const spoofFrom = buildSpoofAddress(domain, scenario);
    const customerView = isCustomerScenario(scenario);
    const initials = scenario.displayName.slice(0, 1).toUpperCase();
    const timeFull = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });

    return `
      <h2 class="text-base sm:text-xl font-semibold text-[#323130] mb-4 leading-snug shrink-0">${escapeHtml(scenario.subject)}</h2>
      <div class="flex items-start gap-3 mb-5 pb-4 border-b border-[#edebe9]">
        <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#0078d4] text-white flex items-center justify-center text-sm font-semibold shrink-0">${escapeHtml(initials)}</div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span class="font-semibold text-sm sm:text-base text-[#323130]">${escapeHtml(scenario.displayName)}</span>
            <span class="text-xs text-[#605e5c] break-all">&lt;${escapeHtml(spoofFrom)}&gt;</span>
          </div>
          <div class="text-[10px] sm:text-xs text-[#605e5c] mt-1">${customerView ? 'To: Valued Customer' : 'To: You'}</div>
          <div class="text-[10px] text-[#a19f9d] mt-0.5">${escapeHtml(timeFull)}</div>
        </div>
      </div>`;
  }

  function renderOutlookInboxPreview(domain, scenario) {
    const customerView = isCustomerScenario(scenario);
    const { attachmentHtml, linkHtml, bodyHtml } = buildScenarioMessageParts(domain, scenario);

    return `
      <div class="outlook-app relative h-full flex flex-col rounded-2xl overflow-hidden border border-[#edebe9] shadow-xl bg-white text-[#323130]">
        ${renderOutlookChrome('Inbox', 'inbox')}

        <div class="flex flex-1 flex-col min-h-0 bg-white">
          <div class="flex items-center gap-1 px-3 py-1.5 border-b border-[#edebe9] text-[#605e5c] shrink-0">
            <span class="text-[10px] px-2 py-1 rounded shrink-0">Reply</span>
            <span class="text-[10px] px-2 py-1 rounded shrink-0">Forward</span>
          </div>

          <div class="p-4 sm:p-6 flex-1 flex flex-col min-h-0">
            ${renderMessageHeader(domain, scenario)}
            <div class="text-sm sm:text-[15px] text-[#323130] leading-relaxed">
              ${bodyHtml}
              <p class="m-0">Thanks,<br>${escapeHtml(scenario.displayName)}</p>
              ${linkHtml}
              ${attachmentHtml}
            </div>
          </div>
        </div>

        <div class="px-4 py-2 bg-[#faf9f8] border-t border-[#edebe9] text-[10px] text-[#605e5c] text-center shrink-0">
          ${customerView
            ? 'Simulated inbox delivery. What one of your customers might see if spoofed mail gets through.'
            : 'Simulated inbox delivery. What an employee might see if spoofed mail gets through.'}
        </div>
      </div>`;
  }

  function renderOutlookJunkPreview(domain, scenario) {
    const customerView = isCustomerScenario(scenario);
    const { attachmentHtml, linkHtml, bodyHtml } = buildScenarioMessageParts(domain, scenario);

    return `
      <div class="outlook-app relative h-full flex flex-col rounded-2xl overflow-hidden border border-[#edebe9] shadow-xl bg-white text-[#323130]">
        ${renderOutlookChrome('Junk Email', 'junk')}

        <div class="flex flex-1 flex-col min-h-0 bg-white">
          <div class="flex items-center gap-1 px-3 py-1.5 border-b border-[#edebe9] text-[#605e5c] shrink-0">
            <span class="text-[10px] px-2 py-1 rounded shrink-0">Not junk</span>
            <span class="text-[10px] px-2 py-1 rounded shrink-0">Delete</span>
          </div>

          <div class="mx-4 mt-3 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900">
            DMARC quarantine routed this to Junk. It should not appear in the inbox, but some users still check spam folders.
          </div>

          <div class="p-4 sm:p-6 flex-1 flex flex-col min-h-0">
            ${renderMessageHeader(domain, scenario)}
            <div class="text-sm sm:text-[15px] text-[#323130] leading-relaxed">
              ${bodyHtml}
              <p class="m-0">Thanks,<br>${escapeHtml(scenario.displayName)}</p>
              ${linkHtml}
              ${attachmentHtml}
            </div>
          </div>
        </div>

        <div class="px-4 py-2 bg-[#faf9f8] border-t border-[#edebe9] text-[10px] text-[#605e5c] text-center shrink-0">
          ${customerView
            ? 'Simulated Junk folder. What a customer might see if they open spam — not a normal inbox delivery.'
            : 'Simulated Junk folder. What an employee might see if they open spam — not a normal inbox delivery.'}
        </div>
      </div>`;
  }

  function renderOutlookBlockedPreview(domain, scenario) {
    const spoofFrom = buildSpoofAddress(domain, scenario);
    const customerView = isCustomerScenario(scenario);

    return `
      <div class="outlook-app relative h-full flex flex-col rounded-2xl overflow-hidden border border-[#edebe9] shadow-xl bg-white text-[#323130]">
        ${renderOutlookChrome('Inbox', 'inbox')}

        <div class="flex flex-1 flex-col min-h-0 bg-[#faf9f8]">
          <div class="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center">
            <div class="w-14 h-14 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mb-4">
              <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 5c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
              </svg>
            </div>
            <h2 class="text-lg sm:text-xl font-semibold text-[#323130] m-0">Message not delivered</h2>
            <p class="text-sm text-[#605e5c] mt-2 max-w-md m-0">
              Outlook rejected this message because it failed authentication for <strong class="text-[#323130]">${escapeHtml(domain)}</strong>.
              With DMARC reject, it should never reach the inbox or Junk folder.
            </p>

            <div class="mt-5 w-full max-w-md rounded-xl border border-[#edebe9] bg-white p-4 text-left">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Attempted spoof</div>
              <div class="text-sm font-semibold text-[#323130]">${escapeHtml(scenario.subject)}</div>
              <div class="text-xs text-[#605e5c] mt-1 break-all">${escapeHtml(scenario.displayName)} &lt;${escapeHtml(spoofFrom)}&gt;</div>
              <div class="text-[10px] text-[#a19f9d] mt-2">${customerView ? 'To: Valued Customer' : 'To: You'}</div>
            </div>
          </div>
        </div>

        <div class="px-4 py-2 bg-white border-t border-[#edebe9] text-[10px] text-[#605e5c] text-center shrink-0">
          ${customerView
            ? 'Simulated blocked delivery. Attackers still try to send this, but customers should never receive it.'
            : 'Simulated blocked delivery. Attackers still try to send this, but employees should never receive it.'}
        </div>
      </div>`;
  }

  function renderOutlookPreview(domain, scenario, deliveryOutcome) {
    if (deliveryOutcome === 'blocked') return renderOutlookBlockedPreview(domain, scenario);
    if (deliveryOutcome === 'junk') return renderOutlookJunkPreview(domain, scenario);
    return renderOutlookInboxPreview(domain, scenario);
  }

  function renderEducationalSidebar(data, scenario, scenarioKey) {
    const { domain, spoofRisk } = data;
    const spoofFrom = buildSpoofAddress(domain, scenario);
    const deliveryOutcome = getDeliveryOutcome(data);
    const { social: whySocial, technical: whyTechnical } = getScenarioWhyItWorks(scenarioKey, data);
    const customerView = isCustomerScenario(scenario);

    const recipientTitle = deliveryOutcome === 'blocked'
      ? 'What attackers still try'
      : deliveryOutcome === 'junk'
        ? (customerView ? 'What may appear in Junk' : 'What may appear in Junk')
        : (customerView ? 'What customers see' : 'What recipients see');

    const recipientBullets = deliveryOutcome === 'blocked'
      ? (customerView
        ? [
            `Attackers forge a familiar sender like <strong class="text-slate-800">${escapeHtml(scenario.displayName)}</strong> with your company name`,
            `They use your real domain (<strong class="font-mono text-slate-800">${escapeHtml(spoofFrom)}</strong>), not a lookalike address`,
            'With DMARC reject, providers should refuse delivery before anyone sees the message',
          ]
        : [
            `Attackers forge a familiar name like <strong class="text-slate-800">${escapeHtml(scenario.displayName)}</strong> in the sender field`,
            `They use your real domain (<strong class="font-mono text-slate-800">${escapeHtml(spoofFrom)}</strong>), not a lookalike address`,
            'With DMARC reject, providers should refuse delivery before employees see the message',
          ])
      : deliveryOutcome === 'junk'
        ? (customerView
          ? [
              `A familiar sender like <strong class="text-slate-800">${escapeHtml(scenario.displayName)}</strong> can still appear with your company name`,
              `Your real domain (<strong class="font-mono text-slate-800">${escapeHtml(spoofFrom)}</strong>), not a lookalike address`,
              'Junk is better than inbox, but some people still open spam and act on urgent requests',
            ]
          : [
              `A familiar name like <strong class="text-slate-800">${escapeHtml(scenario.displayName)}</strong> can still appear in the sender field`,
              `Your real domain (<strong class="font-mono text-slate-800">${escapeHtml(spoofFrom)}</strong>), not a lookalike address`,
              'Junk is better than inbox, but some employees still open spam and act without verifying',
            ])
        : (customerView
          ? [
              `A familiar sender like <strong class="text-slate-800">${escapeHtml(scenario.displayName)}</strong> appears with your company name`,
              `Your real domain (<strong class="font-mono text-slate-800">${escapeHtml(spoofFrom)}</strong>), not a lookalike address`,
              'Urgent account or service language that pushes customers to act before calling you',
            ]
          : [
              `In Outlook, a familiar name like <strong class="text-slate-800">${escapeHtml(scenario.displayName)}</strong> appears in the sender field`,
              `Your real domain (<strong class="font-mono text-slate-800">${escapeHtml(spoofFrom)}</strong>), not a lookalike address`,
              'Urgent, routine-sounding language that pressures fast action without verification',
            ]);

    return `
      <div class="space-y-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-5">
          <div class="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-3">${recipientTitle}</div>
          <ul class="space-y-3 text-sm text-slate-600">
            ${recipientBullets.map((text, i) => `
            <li class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">${i + 1}</span>
              <span>${text}</span>
            </li>`).join('')}
          </ul>
        </div>

        <div class="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <div class="text-xs font-semibold tracking-wider text-amber-700 uppercase mb-2">Why this scenario works</div>
          <p class="text-sm text-amber-900 leading-snug m-0">${escapeHtml(whySocial)}</p>
          <p class="text-sm text-amber-800/90 leading-snug m-0 mt-2">${escapeHtml(whyTechnical)}</p>
        </div>

        <div class="rounded-2xl border border-teal-200 bg-teal-50/50 p-5">
          <div class="text-xs font-semibold tracking-wider text-teal-700 uppercase mb-2">Want the technical details?</div>
          <p class="text-sm text-slate-600 leading-relaxed m-0 mb-3">
            Want the technical side? Our free DMARC checker shows your DNS records and recommended fix steps.
          </p>
          <a href="https://dmarc.network26.com/?domain=${encodeURIComponent(domain)}" class="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-2">
            View full DMARC report for ${escapeHtml(domain)}
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
          </a>
        </div>
      </div>`;
  }

  function renderWhyItFoolsSection() {
    return `
      <section id="how-it-works" class="scroll-mt-20">
        <div class="text-center mb-8 sm:mb-10">
          <div class="text-teal-600 text-xs tracking-[2px] font-semibold">WHY IT FOOLS PEOPLE</div>
        </div>

        <div class="grid md:grid-cols-3 gap-4 sm:gap-5 max-w-5xl mx-auto">
          <div class="service-card bg-white border border-teal-200 rounded-3xl px-5 py-6 sm:px-6 sm:py-7">
            <div class="step-number w-9 h-9 rounded-2xl flex items-center justify-center text-base mb-4">1</div>
            <h3 class="font-semibold text-lg mb-2">Looks like someone you trust</h3>
            <p class="text-[15px] text-slate-600 leading-relaxed">The display name says "CEO" or "IT Support." The address shows your real domain, not a typo like <code class="text-xs bg-slate-100 px-1 rounded">yourcornpany.com</code>. That's what makes it convincing.</p>
          </div>

          <div class="service-card bg-white border border-teal-200 rounded-3xl px-5 py-6 sm:px-6 sm:py-7">
            <div class="step-number w-9 h-9 rounded-2xl flex items-center justify-center text-base mb-4">2</div>
            <h3 class="font-semibold text-lg mb-2">Creates urgency</h3>
            <p class="text-[15px] text-slate-600 leading-relaxed">Fake invoices, wire transfers, password resets, and emails to your customers all pressure people to act fast, before they call to verify. Switch scenarios above to see common attacks attackers use every day.</p>
          </div>

          <div class="service-card bg-white border border-teal-200 rounded-3xl px-5 py-6 sm:px-6 sm:py-7">
            <div class="step-number w-9 h-9 rounded-2xl flex items-center justify-center text-base mb-4">3</div>
            <h3 class="font-semibold text-lg mb-2">No obvious red flags</h3>
            <p class="text-[15px] text-slate-600 leading-relaxed">Without email authentication, there's often no warning banner, no "external sender" label, and no reason to suspect the message isn't real until it's too late.</p>
          </div>
        </div>
      </section>`;
  }

  function renderScenarioPicker(activeKey) {
    return Object.entries(SCENARIOS).map(([key, s]) => `
      <button
        type="button"
        class="scenario-tab touch-target shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors ${key === activeKey ? 'bg-white border-teal-300 text-slate-900 shadow-sm' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60'}"
        data-scenario="${escapeHtml(key)}"
      >${escapeHtml(s.label)}</button>`).join('');
  }

  function renderLoadingState(activeStep) {
    const stepsHtml = LOADING_STEPS.map((label, i) => {
      let state = 'is-pending';
      if (i < activeStep) state = 'is-done';
      else if (i === activeStep) state = 'is-active';
      return `
        <div class="loading-step ${state} flex items-center gap-2.5 p-2.5 sm:p-3 rounded-2xl border border-slate-100 bg-slate-50/80">
          <div class="loading-step-dot w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all">
            ${i < activeStep ? '<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : (i === activeStep ? '<div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>' : '')}
          </div>
          <span class="text-[11px] sm:text-xs font-medium ${i <= activeStep ? 'text-slate-700' : 'text-slate-400'} leading-tight">${escapeHtml(label)}</span>
        </div>`;
    }).join('');

    return `
      <div class="rounded-3xl border border-teal-100 bg-white p-5 sm:p-6 md:p-8 mb-6 sm:mb-8 shadow-sm">
        <div class="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
          <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
            <svg class="spinner w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
          <div>
            <div class="font-semibold text-slate-900">Preparing your preview</div>
            <div class="text-sm text-teal-600 mt-0.5">${escapeHtml(LOADING_STEPS[activeStep])}…</div>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 max-w-xl">${stepsHtml}</div>
      </div>`;
  }

  function renderResults(data, scenarioKey = 'invoice') {
    const { domain } = data;
    const deliveryOutcome = getDeliveryOutcome(data);
    const scenario = getScenario(scenarioKey);

    return `
      <div id="results-header">${renderDeliveryOutlookTile(data)}</div>

      <div class="mb-4 sm:mb-5 text-center">
        <p class="text-sm text-slate-600 mb-3">Choose a common scenario</p>
        <div class="flex flex-nowrap justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 w-full max-w-3xl mx-auto overflow-x-auto" role="tablist" aria-label="Spoof scenario">
          ${renderScenarioPicker(scenarioKey)}
        </div>
      </div>

      <div class="grid lg:grid-cols-5 lg:items-stretch gap-6 sm:gap-8 mb-8 sm:mb-10">
        <div class="lg:col-span-3 min-w-0 flex flex-col">
          <div id="preview-container" class="relative flex-1 flex flex-col min-h-0">
            ${renderOutlookPreview(domain, scenario, deliveryOutcome)}
          </div>
          <p id="preview-caption" class="text-xs text-slate-400 text-center mt-3 lg:hidden">${escapeHtml(previewCaption(deliveryOutcome))}</p>
        </div>
        <div id="educational-sidebar" class="lg:col-span-2 min-w-0">
          ${renderEducationalSidebar(data, scenario, scenarioKey)}
        </div>
      </div>

      ${renderWhyItFoolsSection()}`;
  }

  function updateBottomCta(domain) {
    const ctaDomain = document.getElementById('cta-domain');
    const ctaNote = document.getElementById('cta-domain-note');
    if (ctaDomain) ctaDomain.textContent = domain;
    if (ctaNote) ctaNote.classList.remove('hidden');
  }

  function refreshPreview(data, scenarioKey) {
    const { domain } = data;
    const deliveryOutcome = getDeliveryOutcome(data);
    const scenario = getScenario(scenarioKey);

    const container = document.getElementById('preview-container');
    if (container) {
      container.innerHTML = renderOutlookPreview(domain, scenario, deliveryOutcome);
    }

    const caption = document.getElementById('preview-caption');
    if (caption) {
      caption.textContent = previewCaption(deliveryOutcome);
    }

    const sidebar = document.getElementById('educational-sidebar');
    if (sidebar) {
      sidebar.innerHTML = renderEducationalSidebar(data, scenario, scenarioKey);
    }

    document.querySelectorAll('.scenario-tab').forEach((tab) => {
      tab.classList.toggle('bg-white', tab.dataset.scenario === scenarioKey);
      tab.classList.toggle('border-teal-300', tab.dataset.scenario === scenarioKey);
      tab.classList.toggle('text-slate-900', tab.dataset.scenario === scenarioKey);
      tab.classList.toggle('shadow-sm', tab.dataset.scenario === scenarioKey);
      tab.classList.toggle('border-transparent', tab.dataset.scenario !== scenarioKey);
      tab.classList.toggle('text-slate-500', tab.dataset.scenario !== scenarioKey);
    });
  }

  function bindScenarioTabs(data) {
    let activeScenario = 'invoice';
    document.querySelectorAll('.scenario-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        activeScenario = tab.dataset.scenario;
        refreshPreview(data, activeScenario);
        data._activeScenario = activeScenario;
      });
    });
  }

  function setLoading(loading) {
    const btn = document.getElementById('check-btn');
    const btnText = document.getElementById('check-btn-text');
    const spinner = document.getElementById('check-spinner');
    const input = document.getElementById('domain-input');
    if (btn) btn.disabled = loading;
    if (input) input.disabled = loading;
    if (spinner) spinner.classList.toggle('hidden', !loading);
    if (btnText) btnText.textContent = loading ? 'Building preview…' : 'Show Spoof Preview';
  }

  function showError(msg) {
    const el = document.getElementById('checker-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideError() {
    document.getElementById('checker-error').classList.add('hidden');
  }

  function scrollToResults() {
    const el = document.getElementById('results-header') || document.getElementById('results');
    if (!el) return;
    const nav = document.querySelector('nav');
    const offset = (nav?.offsetHeight || 64) + 16;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function mapProgressStep(step) {
    return step <= 1 ? 0 : 1;
  }

  async function handleCheck(rawDomain) {
    hideError();
    const domain = EmailAuthChecker.sanitizeDomain(rawDomain);
    if (!domain) {
      showError('Please enter a valid domain name (e.g. yourcompany.com).');
      return;
    }

    setLoading(true);
    const resultsEl = document.getElementById('results');
    resultsEl.innerHTML = renderLoadingState(0);
    resultsEl.classList.remove('hidden');

    try {
      const data = await EmailAuthChecker.checkDomain(domain, (step) => {
        resultsEl.innerHTML = renderLoadingState(mapProgressStep(step));
      });

      window.__lastSpoofData = data;
      data._activeScenario = 'invoice';
      resultsEl.innerHTML = renderResults(data, 'invoice');
      bindScenarioTabs(data);

      updateBottomCta(domain);

      history.replaceState(null, '', `?domain=${encodeURIComponent(domain)}`);
      requestAnimationFrame(() => scrollToResults());
    } catch (err) {
      showError('Could not look up DNS records. Check your connection and try again.');
      resultsEl.classList.add('hidden');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function init() {
    const form = document.getElementById('checker-form');
    const input = document.getElementById('domain-input');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleCheck(input.value);
    });

    const params = new URLSearchParams(window.location.search);
    const prefill = params.get('domain');
    if (prefill) {
      input.value = prefill;
      handleCheck(prefill);
    }

  }

  window.addEventListener('DOMContentLoaded', init);
})();