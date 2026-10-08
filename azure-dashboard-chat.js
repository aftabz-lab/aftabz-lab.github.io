/* Compatibility loader for existing dashboard HTML. Azure has been replaced by free local AI. */
(() => {
  'use strict';
  if (window !== window.top || new URLSearchParams(location.search).get('snapshot-worker') === '1' || window.__shwapnoFreeAssistant) return;
  const path = location.pathname.replace(/\/index\.html$/, '/');
  const included = ['/', '/receiving-dashboard-shwapno/', '/credit-card-extra-amount/', '/zreport-dual-dashboard/', '/visit-compliance-dashboard/', '/visit-compliance-dashboard/audit.html', '/zone-distribution-dashboard/', '/Pricing-control-dashboard-Shwapno/'];
  if (!included.includes(path) || document.getElementById('shwapno-free-assistant-loader')) return;
  const loader = document.createElement('script');
  loader.id = 'shwapno-free-assistant-loader';
  loader.src = new URL('dashboard-ai.js?v=free-ai-20261008', document.currentScript.src).href;
  loader.defer = true;
  document.head.append(loader);
})();
