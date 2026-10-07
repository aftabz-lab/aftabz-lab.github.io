(() => {
  'use strict';
  const script = document.currentScript;
  const routes = {
    '/': ['portal', 'Dashboard Portal'],
    '/index.html': ['portal', 'Dashboard Portal'],
    '/receiving-dashboard-shwapno/': ['receiving', 'Receiving Dashboard'],
    '/credit-card-extra-amount/': ['credit-card', 'Credit Card Extra Amount'],
    '/zreport-dual-dashboard/': ['zreport', 'Z-Report'],
    '/visit-compliance-dashboard/': ['visit', 'Visit Compliance'],
    '/visit-compliance-dashboard/audit.html': ['audit', 'Audit Quality'],
    '/zone-distribution-dashboard/': ['zone', 'Zone Distribution'],
    '/Pricing-control-dashboard-Shwapno/': ['pricing', 'Pricing Control'],
  };
  const path = location.pathname.replace(/\/index\.html$/, '/');
  const dashboard = routes[path];
  if (!dashboard || new URLSearchParams(location.search).get('snapshot-worker') === '1' || window !== window.top) return;
  const configUrl = new URL('azure-dashboard-chat-config.json', script.src);

  function start() {
    if (document.getElementById('shwapno-azure-assistant')) return;
    const host = document.createElement('div');
    host.id = 'shwapno-azure-assistant';
    const shadow = host.attachShadow({mode: 'open'});
    shadow.innerHTML = `<style>
      :host{all:initial;position:fixed;right:18px;bottom:20px;z-index:1200;--chat-bg:#0f2830;--chat-alt:#14333d;--chat-ink:#e8f0f1;--chat-soft:#a3bcc2;--chat-line:#21474f;--chat-accent:#58a7c9;font-family:Inter,"Segoe UI",system-ui,-apple-system,Arial,sans-serif}
      :host([data-theme=light]){--chat-bg:#fff;--chat-alt:#f3f7f8;--chat-ink:#0c2229;--chat-soft:#47646d;--chat-line:#cfdcdf;--chat-accent:#1c6b87}
      *{box-sizing:border-box}[hidden]{display:none!important}button,textarea{font:inherit}button{cursor:pointer;touch-action:manipulation}button:disabled{cursor:wait;opacity:.6}button:focus-visible,textarea:focus-visible{outline:2px solid #e5202e;outline-offset:2px}
      .launcher{height:42px;display:flex;align-items:center;gap:8px;padding:0 14px;background:var(--chat-bg);color:var(--chat-ink);border:1px solid var(--chat-accent);border-radius:7px;font-size:12px;font-weight:650}
      .launcher svg{width:17px;height:17px;stroke:var(--chat-accent);fill:none;stroke-width:1.6}
      .panel{width:min(390px,calc(100vw - 24px));height:min(540px,calc(100dvh - 110px));min-height:240px;display:flex;flex-direction:column;background:var(--chat-bg);color:var(--chat-ink);border:1px solid var(--chat-line);border-radius:14px;overflow:hidden;margin-bottom:10px;box-shadow:0 24px 64px rgba(4,6,10,.3);font-size:13px;line-height:1.5}
      .head{padding:14px 15px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid var(--chat-line)}.head strong{display:block;font-size:14px}.head small{display:block;font-size:11px;color:var(--chat-soft);margin-top:2px}.tools{display:flex;gap:5px}.tools button{width:30px;height:30px;border:1px solid var(--chat-line);border-radius:7px;background:var(--chat-alt);color:var(--chat-ink);font-size:17px}
      .messages{flex:1;min-height:0;overflow:auto;padding:14px;scrollbar-color:var(--chat-line) var(--chat-alt)}.message{margin:0 0 12px;white-space:pre-wrap;overflow-wrap:anywhere}.message strong{display:block;font-size:11px;color:var(--chat-soft);margin-bottom:3px}.user{background:var(--chat-alt);padding:10px 12px;border-radius:7px}.error{border-left:2px solid var(--chat-accent);padding-left:10px;color:var(--chat-soft)}
      .scope{margin:0;padding:8px 14px;border-top:1px solid var(--chat-line);color:var(--chat-soft);font-size:10.5px}.form{display:flex;gap:8px;padding:11px 14px;border-top:1px solid var(--chat-line);align-items:flex-end}.form textarea{resize:none;min-width:0;flex:1;height:57px;padding:8px 9px;border:1px solid var(--chat-line);border-radius:7px;background:var(--chat-alt);color:var(--chat-ink);font-size:12px;line-height:1.5}.form button{height:36px;padding:0 12px;border:1px solid var(--chat-line);border-radius:7px;background:var(--chat-alt);color:var(--chat-ink);font-size:12px;font-weight:650}
      @media(max-width:600px){:host{right:12px;bottom:20px}.panel{height:min(510px,calc(100dvh - 96px))}.launcher{height:38px;font-size:11px}}@media print{:host{display:none!important}}
      @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
    </style>
    <section class="panel" id="chat-panel" role="dialog" aria-label="Dashboard assistant" hidden>
      <div class="head"><div><strong>Dashboard assistant</strong><small>Azure OpenAI · <span id="chat-dashboard"></span></small></div><div class="tools"><button id="chat-clear" type="button" title="New conversation" aria-label="New conversation">↺</button><button id="chat-close" type="button" title="Close assistant" aria-label="Close assistant">×</button></div></div>
      <div class="messages" id="chat-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
      <p class="scope" id="chat-scope">Replies use the visible dashboard view and its current filters.</p>
      <form class="form" id="chat-form"><textarea id="chat-question" rows="2" maxlength="2000" aria-label="Ask about this dashboard" placeholder="Ask about this dashboard…"></textarea><button id="chat-send" type="submit">Send</button></form>
    </section>
    <button class="launcher" id="chat-open" type="button" aria-label="Open Azure OpenAI dashboard assistant" aria-expanded="false" aria-controls="chat-panel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H9l-5 4z"/><path d="M8 8h8M8 12h5"/></svg>Ask AI</button>`;
    document.body.append(host);
    const $ = id => shadow.getElementById(id);
    $('chat-dashboard').textContent = dashboard[1];
    let history = [], busy = false, endpointPromise = null, controller = null, generation = 0;

    function updateTheme() {
      const explicit = document.documentElement.dataset.theme || document.body.dataset.theme;
      const scheme = getComputedStyle(document.documentElement).colorScheme || '';
      host.dataset.theme = explicit === 'light' || (!explicit && scheme.startsWith('light')) ? 'light' : 'dark';
    }
    const observer = new MutationObserver(updateTheme);
    for (const node of [document.documentElement, document.body]) observer.observe(node, {attributes: true, attributeFilter: ['data-theme', 'class']});
    window.addEventListener('dashboard-theme-change', updateTheme);
    updateTheme();

    function bubble(role, content) {
      const row = document.createElement('div');
      row.className = 'message ' + role;
      const label = document.createElement('strong');
      label.textContent = role === 'user' ? 'You' : role === 'error' ? 'Assistant status' : 'Assistant';
      const text = document.createElement('span');
      text.textContent = content;
      row.append(label, text);
      $('chat-messages').append(row);
      $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
      return row;
    }
    function greeting() {bubble('assistant', 'Ask about the figures, filters, outlets or exceptions in this view. I will use the visible data and identify any missing information.');}
    greeting();
    function setBusy(value) {busy = value; $('chat-send').disabled = value; $('chat-send').textContent = value ? 'Thinking…' : 'Send';}
    function open(value) {$('chat-panel').hidden = !value; $('chat-open').setAttribute('aria-expanded', String(value)); if (value) $('chat-question').focus(); else $('chat-open').focus();}
    $('chat-open').addEventListener('click', () => open($('chat-panel').hidden));
    $('chat-close').addEventListener('click', () => open(false));
    $('chat-clear').addEventListener('click', () => {generation++;controller?.abort();history=[];$('chat-messages').replaceChildren();$('chat-question').value='';setBusy(false);greeting();$('chat-question').focus();});
    shadow.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !$('chat-panel').hidden) {event.preventDefault();open(false);}
      if (event.target === $('chat-question') && event.key === 'Enter' && !event.shiftKey && !event.isComposing) {event.preventDefault();if (!busy) $('chat-form').requestSubmit();}
      event.stopPropagation();
    });

    async function endpoint() {
      if (!endpointPromise) endpointPromise = (async () => {
        const response = await fetch(configUrl, {cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(15000)});
        if (!response.ok) throw new Error('The assistant connection is not configured yet. Complete the shared Azure setup.');
        const config = await response.json();
        if (Object.keys(config).some(key => /api.?key|secret|token/i.test(key))) throw new Error('The assistant configuration must contain only the shared chat URL. Keep Azure credentials on the server.');
        if (!config.chatEndpoint) throw new Error('The assistant connection is not configured yet. Complete the shared Azure setup.');
        const url = new URL(config.chatEndpoint);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('The shared assistant URL needs a valid HTTPS address without credentials or query parameters.');
        if (/\.(openai|services\.ai)\.azure\.com$/i.test(url.hostname)) throw new Error('Use the shared Azure Function chat URL, not the Azure model endpoint.');
        return url.href;
      })().catch(error => {endpointPromise=null;throw error;});
      return endpointPromise;
    }
    function visibleText(root, limit) {
      if (!root) return '';
      if (typeof root.innerText === 'string') return root.innerText.trim().slice(0, limit);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), parts = [];
      let node, count=0;
      while ((node=walker.nextNode()) && count<limit) {
        const parent=node.parentElement;
        if (!parent || parent.closest('script,style,noscript,iframe,[hidden],[aria-hidden="true"],[data-drive-owner-only]')) continue;
        const style=getComputedStyle(parent);
        if (style.display==='none' || style.visibility==='hidden') continue;
        const value=node.textContent.replace(/\s+/g,' ').trim();
        if (value) {parts.push(value);count+=value.length+1;}
      }
      return parts.join('\n').slice(0,limit);
    }
    function captureContext() {
      const root=document.querySelector('main') || document.body;
      const detail=[...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].find(node => !node.hidden && getComputedStyle(node).display !== 'none');
      const filters=[];
      for (const node of document.querySelectorAll('main input,main select,.sidebar input,.sidebar select,.filter-panel input,.filter-panel select,.multi-toggle')) {
        if (filters.length>=30) break;
        if (node.closest('[hidden],[aria-hidden="true"],[data-drive-owner-only],.drive-modal,.modal-backdrop') || ['password','file','hidden','email'].includes(node.type) || /google-|azure-|api-|secret|token|password/i.test(node.id || node.name || '')) continue;
        if (getComputedStyle(node).display==='none') continue;
        const label=(node.labels?.[0]?.textContent || node.getAttribute('aria-label') || node.name || node.id || 'Selection').trim().slice(0,80);
        const value=node.tagName==='SELECT' ? [...node.selectedOptions].map(option=>option.textContent).join(', ') : node.type==='checkbox' || node.type==='radio' ? (node.checked ? node.value : '') : node.value ?? node.textContent;
        if (String(value??'').trim()) filters.push({label,value:String(value).trim().slice(0,180)});
      }
      const snapshots=[...document.querySelectorAll('#snapshotTime,#snapshotLabel,#headerSnapshotTime,[data-snapshot-key],.snapshot-state,.snapshot-info,.last-snapshot')].filter(node=>!node.closest('[hidden]')).map(node=>node.textContent.trim()).join(' · ').slice(0,1000);
      const context={dashboardId:dashboard[0],dashboard:dashboard[1],title:document.title.slice(0,200),path:location.pathname.slice(0,200),capturedAt:new Date().toISOString(),snapshot:snapshots,filters,visibleText:visibleText(root,16000),openDetail:visibleText(detail,5000),coverage:'Current visible view only; paginated, hidden and unpublished records are not supplied.'};
      while (JSON.stringify(context).length>27500 && context.visibleText.length) context.visibleText=context.visibleText.slice(0,-512);
      return context;
    }
    $('chat-form').addEventListener('submit', async event => {
      event.preventDefault();
      const question=$('chat-question').value.trim();
      if (!question || busy) return;
      const current=++generation;
      setBusy(true);
      $('chat-question').value='';
      bubble('user',question);
      const pending=bubble('assistant','Reading this view…');
      try {
        const url=await endpoint();
        if (current!==generation) return;
        const context=captureContext();
        const requestController=new AbortController();
        controller=requestController;
        const timeout=setTimeout(()=>requestController.abort(),65000);
        let response;
        try {response=await fetch(url,{method:'POST',mode:'cors',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({context,messages:[...history.slice(-8),{role:'user',content:question}]}),signal:requestController.signal});}
        finally {clearTimeout(timeout);}
        const result=await response.json();
        if (current!==generation) return;
        if (!response.ok) throw new Error(result.error || 'The Azure assistant is temporarily unavailable. Please try again.');
        if (typeof result.reply!=='string' || !result.reply.trim()) throw new Error('Azure did not return an answer. Please try again.');
        pending.remove();
        bubble('assistant',result.reply);
        history.push({role:'user',content:question},{role:'assistant',content:result.reply.slice(0,4000)});
        history=history.slice(-8);
        $('chat-scope').textContent='Azure OpenAI · Current view captured '+new Date(context.capturedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Dhaka'})+' GMT+6.';
      } catch (error) {
        if (current!==generation) return;
        pending.remove();
        bubble('error',error.name==='AbortError' ? 'The assistant took too long to respond. Please try again.' : error instanceof TypeError ? 'Could not reach the Azure assistant. Check its service URL and allowed GitHub Pages origin.' : error.message || 'The assistant could not answer. Please try again.');
        if (!$('chat-question').value) $('chat-question').value=question;
      } finally {if (current===generation) {controller=null;setBusy(false);$('chat-question').focus();}}
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
