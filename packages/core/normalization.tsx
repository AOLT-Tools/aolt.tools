export function normalizeEmail(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function normalizeSpaces(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeIndianMobile(value: string): string {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  const normalized =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;

  if (normalized.length !== 10) {
    return '';
  }

  const first = normalized[0];
  return first >= '6' && first <= '9' ? normalized : '';
}

export function normalizePincode(value: string): string {
  const match = String(value || '').match(/\b[1-9]\d{5}\b/);
  return match ? match[0] : '';
}
