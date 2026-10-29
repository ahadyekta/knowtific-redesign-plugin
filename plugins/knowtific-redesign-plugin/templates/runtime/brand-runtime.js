/* site-redesign brand runtime
 * Applies a brand direction (colours, fonts, radius, logo, tagline) to a variation page.
 * Load order in <head>:  _rd/brands.js  ->  _rd/brand-runtime.js  ->  _rd/tailwind.js
 * Brand choice: ?brand=<id>  >  postMessage {type:'rd-brand', id}  >  first non-"current" brand.
 */
(function () {
  var script = document.currentScript;
  var base = script && script.src ? script.src.replace(/[^/]*$/, '') : '';
  var brands = window.RD_BRANDS || [];
  var root = document.documentElement;

  var css = [
    ':root{--c-primary:#1F4E79;--c-on-primary:#fff;--c-accent:#F2A541;--c-on-accent:#111;--c-bg:#fff;--c-surface:#F4F6F8;',
    '--c-text:#16202A;--c-muted:#5A6672;--c-border:#DDE3E8;--c-dark:#0F1E2B;--c-on-dark:#fff;',
    '--f-heading:system-ui,sans-serif;--f-body:system-ui,sans-serif;--fw-heading:700;--rd-radius:10px}',
    '.rd-ph{position:relative;background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--c-primary) 10%,var(--c-surface)) 0 14px,var(--c-surface) 14px 28px);',
    'border-radius:var(--rd-radius);overflow:hidden;min-height:120px;width:100%}',
    '.rd-ph::after{content:attr(data-label);position:absolute;inset:auto 10px 10px 10px;font:500 12px/1.3 system-ui,sans-serif;',
    'color:var(--c-muted);background:color-mix(in srgb,var(--c-bg) 85%,transparent);padding:6px 8px;border-radius:6px}',
    '.tbc{background:#FFF3B0;color:#5C4500;border-radius:4px;padding:0 4px;font-weight:600;outline:1px dashed #C9A400}',
    'html[data-rd-hide-tbc] .tbc{background:none;color:inherit;outline:none;padding:0;font-weight:inherit}'
  ].join('');
  var style = document.createElement('style');
  style.id = 'rd-runtime-style';
  style.textContent = css;
  (document.head || root).appendChild(style);

  function pickInitial() {
    var q = new URLSearchParams(location.search).get('brand');
    if (q && find(q)) return q;
    var first = brands.filter(function (b) { return b.id !== 'current'; })[0] || brands[0];
    return first ? first.id : null;
  }
  function find(id) { for (var i = 0; i < brands.length; i++) if (brands[i].id === id) return brands[i]; return null; }
  function fontStack(name, fallback) {
    if (!name) return fallback;
    return '"' + name + '", ' + fallback;
  }
  function loadFonts(b) {
    var fams = [];
    var f = b.fonts || {};
    if (f.heading && !f.headingIsSystem) fams.push('family=' + encodeURIComponent(f.heading).replace(/%20/g, '+') + ':wght@400;500;600;700;800');
    if (f.body && f.body !== f.heading && !f.bodyIsSystem) fams.push('family=' + encodeURIComponent(f.body).replace(/%20/g, '+') + ':wght@400;500;600;700');
    var link = document.getElementById('rd-fonts');
    if (!fams.length) { if (link) link.remove(); return; }
    var href = 'https://fonts.googleapis.com/css2?' + fams.join('&') + '&display=swap';
    if (!link) { link = document.createElement('link'); link.id = 'rd-fonts'; link.rel = 'stylesheet'; document.head.appendChild(link); }
    if (link.href !== href) link.href = href;
  }
  var KEY = { primary: 'primary', onPrimary: 'on-primary', accent: 'accent', onAccent: 'on-accent', bg: 'bg', surface: 'surface',
    text: 'text', muted: 'muted', border: 'border', dark: 'dark', onDark: 'on-dark' };

  function applyVars(b) {
    var c = b.colors || {};
    for (var k in KEY) if (c[k]) root.style.setProperty('--c-' + KEY[k], c[k]);
    var f = b.fonts || {};
    root.style.setProperty('--f-heading', fontStack(f.heading, f.headingFallback || 'ui-sans-serif, system-ui, sans-serif'));
    root.style.setProperty('--f-body', fontStack(f.body, f.bodyFallback || 'ui-sans-serif, system-ui, sans-serif'));
    root.style.setProperty('--fw-heading', String(f.headingWeight || 700));
    root.style.setProperty('--rd-radius', b.radius || '10px');
    root.setAttribute('data-brand', b.id);
    loadFonts(b);
  }
  function applyDom(b) {
    var logos = document.querySelectorAll('[data-brand-logo]');
    for (var i = 0; i < logos.length; i++) {
      var el = logos[i], kind = el.getAttribute('data-brand-logo') || 'primary';
      var src = b.logo && (b.logo[kind] || b.logo.primary);
      if (!src) continue;
      var url = /^(https?:|data:|\/)/.test(src) ? src : base + src;
      if (el.tagName === 'IMG') { if (el.getAttribute('src') !== url) el.setAttribute('src', url); }
      else el.style.backgroundImage = 'url("' + url + '")';
    }
    var tags = document.querySelectorAll('[data-brand-tagline]');
    for (var j = 0; j < tags.length; j++) if (b.tagline) tags[j].textContent = b.tagline;
    var names = document.querySelectorAll('[data-brand-name]');
    for (var n = 0; n < names.length; n++) if (b.displayName) names[n].textContent = b.displayName;
  }
  function apply(id) {
    var b = find(id) || find(pickInitial());
    if (!b) return;
    applyVars(b);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { applyDom(b); }, { once: true });
    else applyDom(b);
  }

  apply(pickInitial());
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'rd-brand') apply(d.id);
    if (d.type === 'rd-tbc') { if (d.hide) root.setAttribute('data-rd-hide-tbc', ''); else root.removeAttribute('data-rd-hide-tbc'); }
  });
  if (new URLSearchParams(location.search).get('tbc') === 'hide') root.setAttribute('data-rd-hide-tbc', '');
  window.RD = { apply: apply, brands: brands };
})();
