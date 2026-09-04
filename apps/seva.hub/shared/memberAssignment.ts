function normalizeEngagement(value: string | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function isUnsetMemberEngagement(quality: string | undefined): boolean {
  const current = normalizeEngagement(quality);
  return !current || current === 'engagement';
}

export function matchesMemberEngagement(
  quality: string | undefined,
  engagementLevels: readonly string[]
): boolean {
  const requested = engagementLevels.map(normalizeEngagement).filter(Boolean);
  if (!requested.length) {
    return true;
  }

  if (isUnsetMemberEngagement(quality)) {
    return true;
  }

  return requested.includes(normalizeEngagement(quality));
}
