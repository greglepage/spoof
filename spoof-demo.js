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
        'Please review and process the attached invoice at your earliest convenience. This needs to go out today.',
        'Let me know once it\'s done.',
      ],
      attachment: (domain) => `Invoice_${domain}_Q1.pdf`,
      attachmentSize: '248 KB',
      urgency: 'Common in business email compromise (BEC) attacks.',
    },
    wire: {
      label: 'Wire transfer',
      displayName: 'CFO',
      localPart: 'cfo',
      subject: 'CONFIDENTIAL: Wire transfer instructions',
      preview: 'Need you to handle a time-sensitive wire today. Details in the attached PDF. Do not call, I\'m in meetings.',
      body: [
        'Hi,',
        'I need you to process an urgent wire transfer today. Full instructions are in the attached document.',
        'This is time-sensitive. Please handle before end of day. I\'m in meetings and can\'t take calls.',
      ],
      attachment: (domain) => `Wire_Instructions_${domain}.pdf`,
      attachmentSize: '186 KB',
      urgency: 'Often used to steal money before anyone verifies by phone.',
    },
    it: {
      label: 'IT password reset',
      displayName: 'IT Support',
      localPart: 'it',
      subject: 'Action required: Password expires today',
      preview: 'Your company password expires in 2 hours. Use the link below to reset it now or you\'ll be locked out.',
      body: [
        'Hi,',
        'Your password for company systems expires today. Reset it now to avoid being locked out of email and shared drives.',
        'This is an automated notice from IT. If you\'ve already reset your password, you can ignore this message.',
      ],
      attachment: null,
      fakeLink: 'https://secure-login.example.com/reset',
      urgency: 'Designed to steal login credentials through a fake portal.',
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

  function buildSpoofAddress(domain, scenario) {
    return `${scenario.localPart}@${domain}`;
  }

  function normalizeExposure(exposureOrRisk) {
    const map = {
      exposed: 'exposed',
      partial: 'partial',
      protected: 'protected',
      high: 'exposed',
      medium: 'partial',
      low: 'protected',
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
      protected: {
        bg: 'bg-teal-50 border-teal-200',
        dot: 'bg-teal-500',
        label: 'Likely blocked',
        labelColor: 'text-teal-700',
      },
    };
    return map[exposure] || map.partial;
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
      records.push({ name: 'SPF', state: 'warn', label: 'Soft fail', detail: '~all may still allow spoofed mail through' });
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

  function renderOutlookPreview(domain, scenario, exposure) {
    const spoofFrom = buildSpoofAddress(domain, scenario);
    const initials = scenario.displayName.slice(0, 1).toUpperCase();
    const timeFull = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });

    const blockedBanner = exposure === 'protected'
      ? `<div class="mx-4 mt-3 px-3 py-2 rounded-md bg-teal-50 border border-teal-200 text-xs text-teal-800">
           With your current protection, Outlook would likely move this to Junk or block it entirely.
         </div>`
      : '';

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

    return `
      <div class="outlook-app relative rounded-2xl overflow-hidden border border-[#edebe9] shadow-xl bg-white text-[#323130]">
        <div class="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-[#0078d4] text-white">
          <div class="flex items-center gap-1.5 shrink-0">
            <svg class="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z"/></svg>
            <span class="text-xs sm:text-sm font-semibold">Outlook</span>
          </div>
          <div class="flex-1 text-center text-[10px] sm:text-xs text-white/80 truncate">Inbox</div>
        </div>

        <div class="flex flex-col bg-white">
          <div class="flex items-center gap-1 px-3 py-1.5 border-b border-[#edebe9] text-[#605e5c]">
            <span class="text-[10px] px-2 py-1 rounded shrink-0">Reply</span>
            <span class="text-[10px] px-2 py-1 rounded shrink-0">Forward</span>
          </div>

          ${blockedBanner}

          <div class="p-4 sm:p-6">
            <h2 class="text-base sm:text-xl font-semibold text-[#323130] mb-4 leading-snug">${escapeHtml(scenario.subject)}</h2>
            <div class="flex items-start gap-3 mb-5 pb-4 border-b border-[#edebe9]">
              <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#0078d4] text-white flex items-center justify-center text-sm font-semibold shrink-0">${escapeHtml(initials)}</div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span class="font-semibold text-sm sm:text-base text-[#323130]">${escapeHtml(scenario.displayName)}</span>
                  <span class="text-xs text-[#605e5c] break-all">&lt;${escapeHtml(spoofFrom)}&gt;</span>
                </div>
                <div class="text-[10px] sm:text-xs text-[#605e5c] mt-1">To: You</div>
                <div class="text-[10px] text-[#a19f9d] mt-0.5">${escapeHtml(timeFull)}</div>
              </div>
            </div>
            <div class="text-sm sm:text-[15px] text-[#323130] leading-relaxed">
              ${bodyHtml}
              <p class="m-0">Thanks,<br>${escapeHtml(scenario.displayName)}</p>
              ${linkHtml}
              ${attachmentHtml}
            </div>
          </div>
        </div>

        <div class="px-4 py-2 bg-[#faf9f8] border-t border-[#edebe9] text-[10px] text-[#605e5c] text-center">
          Simulated Outlook message. What an employee might see in their inbox.
        </div>
      </div>`;
  }

  function renderEducationalSidebar(data, scenario) {
    const { domain } = data;
    const spoofFrom = buildSpoofAddress(domain, scenario);

    return `
      <div class="space-y-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-5">
          <div class="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-3">What recipients see</div>
          <ul class="space-y-3 text-sm text-slate-600">
            <li class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
              <span>In Outlook, a familiar name like <strong class="text-slate-800">${escapeHtml(scenario.displayName)}</strong> appears in the sender field</span>
            </li>
            <li class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
              <span>Your real domain (<strong class="font-mono text-slate-800">${escapeHtml(spoofFrom)}</strong>), not a lookalike address</span>
            </li>
            <li class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
              <span>Urgent, routine-sounding language that pressures fast action without verification</span>
            </li>
          </ul>
        </div>

        <div class="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <div class="text-xs font-semibold tracking-wider text-amber-700 uppercase mb-2">Why this scenario works</div>
          <p class="text-sm text-amber-900 leading-relaxed m-0">${escapeHtml(scenario.urgency)}</p>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div class="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-2">How spoofing works</div>
          <p class="text-sm text-slate-600 leading-relaxed m-0">
            No one hacked your email server. An attacker simply puts your domain in the <strong class="text-slate-800">From</strong> field from their own server and hopes someone acts before verifying.
          </p>
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
      <section id="how-it-works" class="mb-8 sm:mb-12 scroll-mt-20">
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
            <p class="text-[15px] text-slate-600 leading-relaxed">Fake invoices, wire transfers, and password resets all pressure people to act fast, before they call to verify. Switch scenarios above to see common attacks attackers use every day.</p>
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
        class="scenario-tab touch-target px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors ${key === activeKey ? 'bg-white border-teal-300 text-slate-900 shadow-sm' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60'}"
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
    const { domain, spoofRisk } = data;
    const exposure = spoofRisk.exposure || spoofRisk.risk || 'partial';
    const scenario = getScenario(scenarioKey);

    return `
      <div id="results-header">${renderDeliveryOutlookTile(data)}</div>

      <div class="mb-4 sm:mb-5 text-center">
        <p class="text-sm text-slate-600 mb-3">Choose a <strong class="font-semibold text-slate-800">common scam scenario</strong> to see what employees might receive.</p>
        <div class="flex flex-wrap justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 max-w-lg mx-auto" role="tablist" aria-label="Spoof scenario">
          ${renderScenarioPicker(scenarioKey)}
        </div>
      </div>

      <div class="grid lg:grid-cols-5 gap-6 sm:gap-8 mb-8 sm:mb-10">
        <div class="lg:col-span-3 min-w-0">
          <div id="preview-container" class="relative">
            ${renderOutlookPreview(domain, scenario, exposure)}
          </div>
          <p class="text-xs text-slate-400 text-center mt-3">Simulated Outlook inbox, for illustration only</p>
        </div>
        <div id="educational-sidebar" class="lg:col-span-2">
          ${renderEducationalSidebar(data, scenario)}
        </div>
      </div>

      ${renderWhyItFoolsSection()}`;
  }

  function updateBottomCta(domain) {
    const ctaDomain = document.getElementById('cta-domain');
    const ctaNote = document.getElementById('cta-domain-note');
    const ctaBtnText = document.getElementById('cta-contact-btn-text');
    if (ctaDomain) ctaDomain.textContent = domain;
    if (ctaNote) ctaNote.classList.remove('hidden');
    if (ctaBtnText) ctaBtnText.textContent = 'Get Help for Your Domain';
  }

  function refreshPreview(data, scenarioKey) {
    const { domain, spoofRisk } = data;
    const exposure = spoofRisk.exposure || spoofRisk.risk || 'partial';
    const scenario = getScenario(scenarioKey);

    const container = document.getElementById('preview-container');
    if (container) {
      container.innerHTML = renderOutlookPreview(domain, scenario, exposure);
    }

    const sidebar = document.getElementById('educational-sidebar');
    if (sidebar) {
      sidebar.innerHTML = renderEducationalSidebar(data, scenario);
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

    document.querySelectorAll('[data-example-domain]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        input.value = el.dataset.exampleDomain;
        handleCheck(el.dataset.exampleDomain);
      });
    });
  }

  window.addEventListener('DOMContentLoaded', init);
})();