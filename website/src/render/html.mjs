export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function externalAttributes(href) {
  return /^https?:\/\//.test(href)
    ? ' target="_blank" rel="noopener noreferrer"'
    : '';
}
