export function withVolunteerTransferNote(
  notes: string,
  from: string,
  to: string | undefined,
  volunteers: Array<{ email: string; name: string }>,
  timestamp: string
): string {
  if (!from || !to || from.trim().toLowerCase() === to.trim().toLowerCase())
    return notes;
  const label = (email: string) =>
    volunteers.find((v) => v.email.trim().toLowerCase() === email.trim().toLowerCase())
      ?.name || email;
  const date = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(timestamp));
  return [`Transferred from ${label(from)} to ${label(to)} on ${date} IST.`, notes]
    .filter(Boolean)
    .join('\n');
}
