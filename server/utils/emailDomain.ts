// Shared rules for the company "email domain" used to route inbound support emails to a company.
// Matching is only as trustworthy as the stored value, so everything is normalized and validated
// here: the company routes (on save) and the storage lookup (on match) both use these helpers.

// Free/consumer mailbox providers. A company can never "own" one of these, and mail from them
// must never be matched to a company just because somebody typed the domain in by mistake.
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'outlook.com', 'hotmail.com',
  'hotmail.co.uk', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
  'zoho.com', 'gmx.com', 'mail.com', 'yandex.com',
]);

// Registry-level suffixes that are shared by many unrelated organisations (kasneb.or.ke is a
// company, "or.ke" is not). Prevents a typo like "co.ke" matching every Kenyan sender, and stops
// the parent-domain walk below from ever climbing up to one of these.
const PUBLIC_SUFFIXES = new Set([
  'co.ke', 'or.ke', 'ac.ke', 'go.ke', 'ne.ke', 'sc.ke', 'me.ke', 'mobi.ke', 'info.ke',
  'co.ug', 'or.ug', 'ac.ug', 'go.ug', 'co.tz', 'or.tz', 'ac.tz', 'go.tz', 'co.rw', 'co.za', 'org.za', 'ac.za',
  'gov.za', 'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.ng', 'org.ng',
]);

const DOMAIN_PATTERN = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** Reduces whatever an admin typed or pasted (URL, full email, "@domain") to a bare lowercase domain. */
export function normalizeEmailDomain(raw: unknown): string {
  let value = String(raw ?? '').trim().toLowerCase();
  value = value.replace(/^mailto:/, '');
  if (value.includes('@')) value = value.slice(value.lastIndexOf('@') + 1);
  value = value.replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '');
  value = value.replace(/^www\./, '').replace(/\.+$/, '');
  return value;
}

/** Returns a human-readable problem with an (already normalized) domain, or null if it is usable. */
export function validateEmailDomain(domain: string): string | null {
  if (!DOMAIN_PATTERN.test(domain)) {
    return 'Enter a valid domain such as kasneb.or.ke (no spaces, no @, no http://).';
  }
  if (FREE_MAIL_DOMAINS.has(domain)) {
    return `${domain} is a free email provider shared by everyone, so it cannot identify a single company.`;
  }
  if (PUBLIC_SUFFIXES.has(domain)) {
    return `${domain} is a shared registry suffix, not an organisation's own domain. Use the full domain, e.g. kasneb.or.ke.`;
  }
  return null;
}

/**
 * The stored domains an inbound sender could legitimately match, most specific first.
 * "billing.kasneb.or.ke" -> ["billing.kasneb.or.ke", "kasneb.or.ke"]. Free-mail senders and
 * public suffixes never produce candidates, so they can never be routed to a company.
 */
export function domainLookupCandidates(senderDomain: string): string[] {
  const domain = normalizeEmailDomain(senderDomain);
  if (!DOMAIN_PATTERN.test(domain) || FREE_MAIL_DOMAINS.has(domain)) return [];

  const labels = domain.split('.');
  const candidates: string[] = [];
  for (let i = 0; i <= labels.length - 2; i++) {
    const candidate = labels.slice(i).join('.');
    if (!PUBLIC_SUFFIXES.has(candidate)) candidates.push(candidate);
  }
  return candidates;
}
