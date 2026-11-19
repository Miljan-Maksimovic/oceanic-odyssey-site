(function () {
  'use strict';

  function channel(a) {
    var href = a.getAttribute('href') || '';
    if (/^https?:\/\/t\.me\/(\+\d|iamthequeenamy)/i.test(href)) return 'telegram';
    if (/^https?:\/\/(wa\.me\/\d|api\.whatsapp\.com\/send\?[^#]*phone=\d|web\.whatsapp\.com\/send\?[^#]*phone=\d)/i.test(href)) return 'whatsapp';
    return '';
  }

  function isChatLink(a) {
    return channel(a) !== '';
  }

  function clean(s) {
    return (s || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  }

  function boatName(a) {
    var tagged = a.closest('[data-boat]');
    if (tagged) return clean(tagged.getAttribute('data-boat'));
    try {
      var text = new URL(a.href).searchParams.get('text') || '';
      var m = text.match(/interested in (?:the )?(.+?)\.(?=\s|$)/i);
      if (m) return clean(m[1]);
    } catch (e) { /* malformed URL: fall through */ }
    var h1 = document.getElementById('yacht-name');
    if (h1) return clean(h1.textContent);
    return 'none';
  }

  function send(a) {
    var app = channel(a);
    var name = app + '_click';
    var params = {
      boat_name: boatName(a),
      link_text: clean(a.textContent) || clean(a.getAttribute('aria-label')),
      page_path: location.pathname,
      channel: app
    };
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, params);
    } catch (e) { /* never block the click */ }
    try {
      if (typeof window.fbq === 'function') {
        window.fbq('trackCustom', name, params);
        window.fbq('track', 'Contact', {content_name: params.boat_name, channel: app});
      }
    } catch (e) { /* never block the click */ }
    try {
      if (window.OO_ADS_CHAT && typeof window.gtag === 'function') window.gtag('event', 'conversion', {send_to: window.OO_ADS_CHAT});
    } catch (e) { /* never block the click */ }
  }

  function onClick(event) {
    var a = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (a && isChatLink(a)) send(a);
  }

  document.addEventListener('click', onClick, true);
  document.addEventListener('auxclick', function (event) {
    if (event.button === 1) onClick(event);
  }, true);

  var SRC_KEY = 'oo_src';
  var SRC_DAYS = 30;

  function detectSource() {
    var p;
    try { p = new URLSearchParams(location.search); } catch (e) { return ''; }
    if (p.get('gclid') || p.get('gbraid') || p.get('wbraid')) return 'Google Ads';
    var us = (p.get('utm_source') || '').toLowerCase();
    var um = (p.get('utm_medium') || '').toLowerCase();
    if (us) {
      if (/^(ig|instagram)/.test(us)) return 'Instagram';
      if (/^(fb|facebook|meta)/.test(us)) return 'Facebook';
      if (/google/.test(us)) return /cpc|ppc|paid/.test(um) ? 'Google Ads' : 'Google';
      if (/tiktok/.test(us)) return 'TikTok';
      return clean(us).slice(0, 30);
    }
    var host = '';
    try { host = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : ''; } catch (e) { host = ''; }
    if (!host || host === location.hostname.toLowerCase()) return p.get('fbclid') ? 'Facebook or Instagram' : '';
    if (/(^|\.)instagram\.com$/.test(host)) return 'Instagram';
    if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/.test(host)) return 'Facebook';
    if (/(^|\.)(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)$/.test(host)) return 'AI chat';
    if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'Google';
    if (/(^|\.)bing\.com$/.test(host)) return 'Bing';
    if (/(^|\.)(t\.me|telegram\.org)$/.test(host)) return 'Telegram';
    if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(host)) return 'WhatsApp';
    if (/(^|\.)tiktok\.com$/.test(host)) return 'TikTok';
    if (/(^|\.)(duckduckgo\.com|yahoo\.[a-z.]+|yandex\.[a-z.]+|baidu\.com|ecosia\.org|naver\.com)$/.test(host)) return 'Search';
    return host.replace(/^www\./, '');
  }

  function source() {
    var now = new Date().getTime();
    var found = detectSource();
    try {
      if (found) {
        localStorage.setItem(SRC_KEY, JSON.stringify({ s: found, t: now }));
        return found;
      }
      var kept = JSON.parse(localStorage.getItem(SRC_KEY) || 'null');
      if (kept && kept.s && now - kept.t < SRC_DAYS * 864e5) return kept.s;
    } catch (e) { /* storage blocked: this page's source only */ }
    return found;
  }

  var SOURCE = source();
  window.OO_SOURCE = SOURCE || 'website';

  function withSource(a) {
    if (!channel(a)) return;
    var href = a.getAttribute('href') || '';
    var m = href.match(/([?&]text=)([^&#]*)/);
    if (!m) return;
    var text = '';
    try { text = decodeURIComponent(m[2].replace(/\+/g, ' ')); } catch (e) { text = m[2]; }
    if (/^\(via /.test(text)) return;   // already tagged (a second tap)
    var tag = '(via ' + (SOURCE || 'website') + ') ';
    a.setAttribute('href', href.replace(m[0], m[1] + encodeURIComponent(tag) + m[2]));
  }

  function onTagClick(event) {
    var a = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (a) withSource(a);
  }
  document.addEventListener('click', onTagClick, false);
  document.addEventListener('auxclick', function (event) {
    if (event.button === 1) onTagClick(event);
  }, false);
})();
