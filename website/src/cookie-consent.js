const consentCookieName = 'mushuc_cookie_consent';
const consentCookieValue = 'accepted';
const consentDurationSeconds = 60 * 60 * 24 * 365;

export function hasCookieConsent(cookieString = '') {
  return cookieString
    .split(';')
    .some((cookie) => cookie.trim() === `${consentCookieName}=${consentCookieValue}`);
}

export function setupCookieConsent(root = globalThis.document) {
  if (!root) return;

  const consentBar = root.querySelector('[data-cookie-consent]');
  const acceptButton = consentBar?.querySelector('[data-cookie-consent-accept]');
  if (!consentBar || !acceptButton) return;

  if (hasCookieConsent(root.cookie)) {
    consentBar.hidden = true;
    return;
  }

  consentBar.hidden = false;
  acceptButton.addEventListener('click', () => {
    const secureAttribute = globalThis.location?.protocol === 'https:' ? '; Secure' : '';
    root.cookie = `${consentCookieName}=${consentCookieValue}; Max-Age=${consentDurationSeconds}; Path=/; SameSite=Lax${secureAttribute}`;
    consentBar.hidden = true;
  });
}

setupCookieConsent();
