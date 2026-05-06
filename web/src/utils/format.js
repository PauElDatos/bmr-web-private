export function fmtNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const abs = Math.abs(Number(value));
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return Number(value).toLocaleString('es-ES', { maximumFractionDigits: digits });
  return Number(value).toLocaleString('es-ES', { maximumFractionDigits: digits });
}

export function fmtPct(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

export function classForLevel(level) {
  const v = String(level || '').toLowerCase();
  if (['risk_off', 'sell', 'alert', 'action', 'alto'].includes(v)) return 'danger';
  if (['watch', 'neutral', 'hold', 'medio'].includes(v)) return 'warn';
  if (['risk_on', 'buy', 'ok', 'bajo'].includes(v)) return 'ok';
  return 'muted';
}

export function lastOf(arr) {
  return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[c]));
}
