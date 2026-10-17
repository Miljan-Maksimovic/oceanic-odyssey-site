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
      if (typeof window.fbq === 'function') window.fbq('trackCustom', name, params);
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
})();
