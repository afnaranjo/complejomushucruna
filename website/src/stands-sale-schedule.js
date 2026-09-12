export const STANDS_SALE_SWITCH_AT = '2026-09-14T07:58:00-05:00';
export const STANDS_SALE_DESTINATION = 'https://reserva.mushucticket.com/customers';

export function isStandsSaleActivated(now = new Date(), switchAt = STANDS_SALE_SWITCH_AT) {
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const switchTime = new Date(switchAt).getTime();
  return Number.isFinite(nowTime) && Number.isFinite(switchTime) && nowTime >= switchTime;
}

export function activateStandsSaleLinks(root = document, now = new Date()) {
  if (!isStandsSaleActivated(now)) return 0;

  const links = [...root.querySelectorAll('[data-stands-purchase-link]')];
  links.forEach((link) => link.setAttribute('href', STANDS_SALE_DESTINATION));
  return links.length;
}

export function setupStandsSaleSchedule(root = document) {
  let timer;

  const applyOrSchedule = () => {
    const now = new Date();
    if (isStandsSaleActivated(now)) {
      activateStandsSaleLinks(root, now);
      return;
    }

    const remaining = new Date(STANDS_SALE_SWITCH_AT).getTime() - now.getTime();
    const maximumDelay = 2_147_483_647;
    timer = globalThis.setTimeout(
      applyOrSchedule,
      Math.min(Math.max(remaining + 25, 25), maximumDelay),
    );
  };

  applyOrSchedule();
  return () => globalThis.clearTimeout(timer);
}
