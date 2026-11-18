// Google tag (Tag Manager container GTM-5NWDCP52) for the public site. Kept in a file because the CSP allows no inline scripts.
// Analytics storage stays denied until the visitor accepts in the consent banner (choice saved as jlc_consent).
(function () {
  var w = window;
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.gtag = gtag;
  var choice = null;
  try { choice = w.localStorage.getItem('jlc_consent'); } catch (e) { /* storage blocked: treat as no choice */ }
  gtag('consent', 'default', {
    analytics_storage: choice === 'granted' ? 'granted' : 'denied',
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  });
  // Pages whose links carry private codes (door key, entry pass, manage and order tokens) never load the tag
  if (/^\/(checkin|c\/|manage|order\/)/.test(w.location.pathname)) return;
  gtag('js', new Date());
  var s = w.document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-5NWDCP52';
  w.document.head.appendChild(s);
})();
