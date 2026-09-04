import { normalizeIndianMobile } from '@aolt/core/normalization';

export type ParserTerm = {
  canonical: string;
  aliases: string[];
};

export type LeadParserCatalog = {
  courses: ParserTerm[];
  leadQualities: ParserTerm[];
  months: ParserTerm[];
};

export type ParsedLeadMessage = {
  mobile: string;
  name: string;
  course: string;
  leadQuality: string;
  month: string;
  notes: string;
  originalMessage: string;
};

type Token = {
  original: string;
  normalized: string;
  line: number;
};

type Span = {
  start: number;
  end: number;
};

type AliasEntry = {
  kind: 'course' | 'leadQuality' | 'month';
  canonical: string;
  aliasTokens: string[];
};

function normalizeWhitespace(message: string): string {
  return String(message || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function trimTokenForMatching(value: string): string {
  let start = 0;
  let end = value.length - 1;

  const isTokenChar = (char: string) => {
    const code = char.charCodeAt(0);
    const isDigit = code >= 48 && code <= 57;
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;
    return isDigit || isUpper || isLower || char === '+';
  };

  while (start <= end && !isTokenChar(value[start])) {
    start += 1;
  }

  while (end >= start && !isTokenChar(value[end])) {
    end -= 1;
  }

  if (start > end) {
    return '';
  }

  return value.slice(start, end + 1).toLowerCase();
}

function toTokens(message: string): Token[] {
  if (!message) {
    return [];
  }

  return message.split(/\r?\n/).flatMap((line, lineIndex) =>
    normalizeWhitespace(line)
      .split(' ')
      .filter(Boolean)
      .map((part) => ({
        original: part,
        normalized: trimTokenForMatching(part),
        line: lineIndex
      }))
  );
}

function isPhoneLikeToken(token: string): boolean {
  const value = String(token || '')
    .trim()
    .replace(/^[,;:.]+|[,;:.]+$/g, '');
  if (!value) {
    return false;
  }

  let hasDigit = false;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    const isDigit = char >= '0' && char <= '9';
    if (isDigit) {
      hasDigit = true;
      continue;
    }

    if (char === '+' || char === '-' || char === '(' || char === ')') {
      continue;
    }

    return false;
  }

  return hasDigit;
}

function findMobile(tokens: Token[]): { mobile: string; span: Span | null } {
  for (let i = 0; i < tokens.length; i += 1) {
    for (let j = i; j < Math.min(i + 4, tokens.length); j += 1) {
      let allPhoneLike = true;
      let combined = '';
      for (let k = i; k <= j; k += 1) {
        if (!isPhoneLikeToken(tokens[k].original)) {
          allPhoneLike = false;
          break;
        }
        combined += tokens[k].original;
      }

      if (!allPhoneLike) {
        continue;
      }

      const mobile = normalizeIndianMobile(combined);
      if (mobile) {
        return {
          mobile,
          span: { start: i, end: j }
        };
      }
    }
  }

  return { mobile: '', span: null };
}

function splitAliasTokens(alias: string): string[] {
  const normalized = normalizeWhitespace(alias);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(' ')
    .map((token) => trimTokenForMatching(token))
    .filter(Boolean);
}

function buildAliasEntries(catalog: LeadParserCatalog): AliasEntry[] {
  const entries: AliasEntry[] = [];
  const pushTerm = (kind: AliasEntry['kind'], term: ParserTerm) => {
    const allAliases = [term.canonical, ...term.aliases];
    for (const alias of allAliases) {
      const aliasTokens = splitAliasTokens(alias);
      if (!aliasTokens.length) {
        continue;
      }

      entries.push({
        kind,
        canonical: term.canonical,
        aliasTokens
      });
    }
  };

  catalog.courses.forEach((term) => pushTerm('course', term));
  catalog.leadQualities.forEach((term) => pushTerm('leadQuality', term));
  catalog.months.forEach((term) => pushTerm('month', term));

  entries.sort((a, b) => b.aliasTokens.length - a.aliasTokens.length);
  return entries;
}

function spanIsFree(used: boolean[], start: number, end: number): boolean {
  for (let i = start; i <= end; i += 1) {
    if (used[i]) {
      return false;
    }
  }

  return true;
}

function markSpan(used: boolean[], start: number, end: number) {
  for (let i = start; i <= end; i += 1) {
    used[i] = true;
  }
}

function matchAliasAt(tokens: Token[], index: number, aliasTokens: string[]): boolean {
  if (index + aliasTokens.length > tokens.length) {
    return false;
  }

  for (let i = 0; i < aliasTokens.length; i += 1) {
    if (tokens[index + i].normalized !== aliasTokens[i]) {
      return false;
    }
  }

  return true;
}

function matchCommaSeparatedCourses(
  token: Token,
  aliasEntries: AliasEntry[]
): string[] {
  if (!token.original.includes(',')) {
    return [];
  }

  const parts = token.original
    .split(',')
    .map((part) => trimTokenForMatching(part))
    .filter(Boolean);

  if (parts.length < 2) {
    return [];
  }

  const courses: string[] = [];
  for (const part of parts) {
    const match = aliasEntries.find(
      (entry) =>
        entry.kind === 'course' &&
        entry.aliasTokens.length === 1 &&
        entry.aliasTokens[0] === part
    );

    // Only consume the token when every comma-delimited value is a course.
    // This keeps ordinary commas in names and notes untouched.
    if (!match) {
      return [];
    }

    if (!courses.includes(match.canonical)) {
      courses.push(match.canonical);
    }
  }

  return courses;
}

function collectNameBefore(tokens: Token[], mobileSpan: Span): Span | null {
  const mobileLine = tokens[mobileSpan.start]?.line;
  let start = mobileSpan.start;
  while (start > 0 && tokens[start - 1].line === mobileLine) {
    start -= 1;
  }

  if (start === mobileSpan.start) {
    return null;
  }

  return { start, end: mobileSpan.start - 1 };
}

function collectNameAfter(
  tokens: Token[],
  mobileSpan: Span,
  aliasEntries: AliasEntry[]
): Span | null {
  const start = mobileSpan.end + 1;
  const mobileLine = tokens[mobileSpan.end]?.line;
  let end = start - 1;

  for (let i = start; i < tokens.length && tokens[i].line === mobileLine; i += 1) {
    const commaSeparatedCourses = matchCommaSeparatedCourses(tokens[i], aliasEntries);
    const startsTag =
      commaSeparatedCourses.length > 0 ||
      aliasEntries.some((entry) => matchAliasAt(tokens, i, entry.aliasTokens));
    if (startsTag) {
      break;
    }
    end = i;
  }

  if (end < start) {
    return null;
  }

  return { start, end };
}

function spanToText(tokens: Token[], span: Span | null): string {
  if (!span) {
    return '';
  }

  return tokens
    .slice(span.start, span.end + 1)
    .map((token) => token.original)
    .join(' ')
    .trim();
}

function cleanName(value: string): string {
  return normalizeWhitespace(value.replace(/[:\-–—]+/g, ' ')).replace(
    /^[,;.\s]+|[,;.\s]+$/g,
    ''
  );
}

export function parseLeadMessage(
  rawMessage: string,
  catalog: LeadParserCatalog
): ParsedLeadMessage {
  const originalMessage = String(rawMessage || '').trim();
  const tokens = toTokens(originalMessage);

  const used = new Array(tokens.length).fill(false);
  const mobileMatch = findMobile(tokens);
  if (mobileMatch.span) {
    markSpan(used, mobileMatch.span.start, mobileMatch.span.end);
  }

  const extracted = {
    courses: [] as string[],
    leadQuality: '',
    month: ''
  };

  const aliasEntries = buildAliasEntries(catalog);
  let nameSpan: Span | null = null;
  if (mobileMatch.span) {
    nameSpan =
      collectNameBefore(tokens, mobileMatch.span) ||
      collectNameAfter(tokens, mobileMatch.span, aliasEntries);
    if (nameSpan) {
      markSpan(used, nameSpan.start, nameSpan.end);
    }
  }

  for (let i = 0; i < tokens.length; i += 1) {
    if (used[i]) {
      continue;
    }

    const commaSeparatedCourses = matchCommaSeparatedCourses(tokens[i], aliasEntries);
    if (commaSeparatedCourses.length) {
      commaSeparatedCourses.forEach((course) => {
        if (!extracted.courses.includes(course)) {
          extracted.courses.push(course);
        }
      });
      used[i] = true;
      continue;
    }

    for (const entry of aliasEntries) {
      if (entry.kind !== 'course' && extracted[entry.kind]) {
        continue;
      }

      const end = i + entry.aliasTokens.length - 1;
      if (!spanIsFree(used, i, end)) {
        continue;
      }

      if (!matchAliasAt(tokens, i, entry.aliasTokens)) {
        continue;
      }

      if (entry.kind === 'course') {
        if (!extracted.courses.includes(entry.canonical)) {
          extracted.courses.push(entry.canonical);
        }
      } else {
        extracted[entry.kind] = entry.canonical;
      }
      markSpan(used, i, end);
      break;
    }
  }

  const notes = tokens
    .map((token, index) => ({ token, index }))
    .filter((item) => !used[item.index])
    .map((item) => item.token.original)
    .join(' ')
    .trim();

  return {
    mobile: mobileMatch.mobile,
    name: cleanName(spanToText(tokens, nameSpan)),
    course: extracted.courses.join(','),
    leadQuality: extracted.leadQuality,
    month: extracted.month,
    notes,
    originalMessage
  };
}
