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
      'meditation and breath workshop',
      'breath workshop'
    ]
  },
  {
    code: 'OMBW',
    label: 'Online Meditation and Breath Workshop',
    typeIds: ['338000', '337993'],
    keywords: ['ombw', 'online meditation and breath workshop']
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
    code: 'IP2',
    label: 'Intuition Process 2',
    typeIds: ['384230'],
    keywords: ['ip2', 'ip 2', 'intuition process 2', 'intuition program 2']
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
      '409022',
      '1495943',
      '1495944',
      '692565',
      '458422',
      '368347',
      '52621',
      '817069',
      '337996',
      '384236'
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
    typeIds: ['337981', '532059'],
    keywords: ['ssy', 'sri sri yoga', 'yoga', 'online yoga', 'yoga classes']
  },
  {
    code: 'SSY_DEEP_DIVE',
    label: 'Sri Sri Yoga Deep Dive',
    typeIds: ['368348'],
    keywords: ['deep dive', 'sri sri yoga deep dive', 'ssy deep dive']
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
    typeIds: ['622743', '65196', '817068'],
    keywords: ['medha', 'medha yoga']
  },
  {
    code: 'UTKARSHA',
    label: 'Utkarsha Yoga',
    typeIds: ['602859', '817070', '12414'],
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
  },
  {
    code: 'SPEED_READING',
    label: '10x Speed Reading Program',
    typeIds: ['1677263'],
    keywords: ['10x', 'speed reading', '10x speed reading']
  },
  {
    code: 'DEEP_SLEEP',
    label: 'Deep Sleep and Anxiety Relief',
    typeIds: ['346148'],
    keywords: ['deep sleep', 'anxiety relief', 'deep sleep and anxiety']
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
