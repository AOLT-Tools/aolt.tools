export type CourseAliasDefinition = {
  code: string;
  label: string;
  typeIds: readonly string[];
  keywords: readonly string[];
};

export type VdsEventAliasDefinition = {
  eventType: string;
  label: string;
  keywords: readonly string[];
};

export const FOLLOW_UP_COURSE_TYPE_IDS = ['351956'] as const;

export const COURSE_ALIASES: readonly CourseAliasDefinition[] = [
  {
    code: 'HP',
    label: 'Happiness Program',
    typeIds: [
      '313040',
      '12371',
      '338000',
      '510212',
      '74889',
      '12519',
      '56368',
      '847760',
      '337993',
      '377155'
    ],
    keywords: [
      'hp',
      'happiness',
      'happiness program',
      'rural happiness',
      'online meditation and breath workshop',
      'meditation and breath workshop',
      'breath workshop',
      'ombw'
    ]
  },
  {
    code: 'AMP',
    label: 'Advanced Meditation Program',
    typeIds: [
      '22119',
      '557041',
      '368354',
      '814381',
      '377492',
      '377494',
      '377493',
      '370064',
      '388897',
      '1305227',
      '377495'
    ],
    keywords: ['amp', 'advanced meditation', 'advanced meditation program']
  },
  {
    code: 'SANYAM',
    label: 'Sanyam',
    typeIds: [],
    keywords: ['sanyam', 'sanyam level 1', 'sanyam level one']
  },
  {
    code: 'IP',
    label: 'Intuition Process',
    typeIds: [
      '377106',
      '376073',
      '384222',
      '1433631',
      '1495972',
      '1495971',
      '1495970',
      '1511479',
      '1511541',
      '1512555',
      '1512557',
      '1511540',
      '1512556',
      '1511542',
      '492176',
      '337991',
      '377117',
      '377474',
      '393338',
      '397683',
      '409022'
    ],
    keywords: [
      'ip',
      'intuition',
      'intuition process',
      'intuition program',
      'intuition junior',
      'intuition kids',
      'intuition teens'
    ]
  },
  {
    code: 'SSY',
    label: 'Sri Sri Yoga',
    typeIds: ['337981', '368348', '532059'],
    keywords: ['ssy', 'sri sri yoga', 'yoga', 'online yoga', 'yoga classes']
  },
  {
    code: 'SSDY',
    label: 'Sahaj Samadhi Dhyana Yoga',
    typeIds: ['339715', '12415'],
    keywords: ['ssdy', 'sahaj samadhi', 'sahaj samadhi dhyana yoga', 'sahaj']
  },
  {
    code: 'DSN',
    label: 'DSN',
    typeIds: ['12427'],
    keywords: ['dsn']
  },
  {
    code: 'MEDHA',
    label: 'Medha Yoga',
    typeIds: ['622743'],
    keywords: ['medha', 'medha yoga']
  },
  {
    code: 'UTKARSHA',
    label: 'Utkarsha Yoga',
    typeIds: ['602859'],
    keywords: ['utkarsha', 'utkarsha yoga']
  },
  {
    code: 'VTP',
    label: 'Volunteer Training Program',
    typeIds: ['55116', '829638', '673007', '338005'],
    keywords: ['vtp', 'volunteer training', 'volunteer training program']
  },
  {
    code: 'FOLLOW_UP',
    label: 'Follow Up',
    typeIds: [...FOLLOW_UP_COURSE_TYPE_IDS],
    keywords: ['follow up', 'followup', 'kriya follow up', 'kriya followup']
  }
];

export const VDS_EVENT_ALIASES: readonly VdsEventAliasDefinition[] = [
  {
    eventType: 'puja',
    label: 'Puja',
    keywords: [
      'puja',
      'pujas',
      'pooja',
      'poojas',
      'rudra puja',
      'guru puja',
      'gau puja',
      'vaidic',
      'vaidic puja',
      'vaidic pujas'
    ]
  },
  {
    eventType: 'homa',
    label: 'Homa',
    keywords: ['homa', 'homas', 'homam', 'havan', 'yagna']
  },
  {
    eventType: 'seva',
    label: 'Seva',
    keywords: ['seva', 'sevas', 'sankalpa', 'donation', 'gaushala']
  },
  {
    eventType: 'event',
    label: 'Event',
    keywords: [
      'navratri',
      'navaratri',
      'samskara',
      'samskaras',
      'upanayanam',
      'parayanam',
      'archana',
      'tarpan'
    ]
  }
];

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeSearchPhrase(value: string): string {
  return tokenize(value).join(' ');
}

export function findCourseAlias(value: string): CourseAliasDefinition | undefined {
  const normalized = normalizeSearchPhrase(value);
  if (!normalized) return undefined;
  const tokenSet = new Set(tokenize(value));

  return COURSE_ALIASES.find((definition) =>
    definition.keywords.some((keyword) => {
      const normalizedKeyword = normalizeSearchPhrase(keyword);
      return normalizedKeyword.includes(' ')
        ? normalized.includes(normalizedKeyword)
        : tokenSet.has(normalizedKeyword);
    })
  );
}

export function findCourseAliasByCode(code: string): CourseAliasDefinition | undefined {
  const normalized = code.trim().toUpperCase();
  return COURSE_ALIASES.find((definition) => definition.code === normalized);
}

export function findVdsEventAlias(value: string): VdsEventAliasDefinition | undefined {
  const normalized = normalizeSearchPhrase(value);
  if (!normalized) return undefined;
  const tokenSet = new Set(tokenize(value));

  return VDS_EVENT_ALIASES.find((definition) =>
    definition.keywords.some((keyword) => {
      const normalizedKeyword = normalizeSearchPhrase(keyword);
      return normalizedKeyword.includes(' ')
        ? normalized.includes(normalizedKeyword)
        : tokenSet.has(normalizedKeyword);
    })
  );
}
