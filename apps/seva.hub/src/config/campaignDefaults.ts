import type {
  AppConfig as ContractAppConfig,
  Campaign as ContractCampaign
} from '../../shared/contracts/appContracts.js';

type CampaignType = ContractCampaign['type'];
type Program = ContractAppConfig['programs'][number];
type CampaignUiMeta = NonNullable<ContractAppConfig['uiByType']>[string];
type QualityMeta = NonNullable<ContractAppConfig['qualityMetaMap']>[string];
type AppConfig = Omit<ContractAppConfig, 'id' | 'allowedUsers'> &
  Partial<Pick<ContractAppConfig, 'id' | 'allowedUsers'>>;

export const DEFAULT_QUALITY_OPTIONS_BY_TYPE = {
  Leads: ['Hot', 'Warm', 'Cold', 'Quality'],
  Members: ['Active', 'Occasional', 'Inactive', 'Shifted', 'Engagement']
} as const;

export const DEFAULT_STATUS_OPTIONS_BY_TYPE = {
  Leads: [
    'Response',
    'Connected',
    'Busy',
    'No Answer',
    'Interested',
    'Registered',
    'Not Interested',
    'Call Back'
  ],
  Members: ['Response', 'Reached', 'Will Attend', 'Maybe', 'Not Available', 'Call Back']
} as const;

export const DEFAULT_PROGRAMS: readonly Program[] = [
  { code: 'HP', label: 'Happiness Program' },
  { code: 'VTP', label: 'Volunteer Training Program' },
  { code: 'DSN', label: 'Divya Samaj Nirman' },
  { code: 'IP', label: 'Intuition Process' },
  { code: 'IP2', label: 'Intuition Process 2' },
  { code: 'Sahaj', label: 'Sahaj Samadhi Meditation' },
  { code: 'YES+', label: 'YES Plus' }
];

export const DEFAULT_QUALITY_META: QualityMeta = {
  icon: '⚪',
  className: 'bg-slate-100 text-slate-600 border-slate-200'
};

export const DEFAULT_QUALITY_META_MAP: Readonly<Record<string, QualityMeta>> = {
  Hot: {
    icon: '🟢',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  Warm: {
    icon: '🟡',
    className: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  Cold: DEFAULT_QUALITY_META,
  Quality: { icon: '✏️', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  Engagement: {
    icon: '✏️',
    className: 'bg-sky-50 text-sky-700 border-sky-200'
  },
  Active: {
    icon: '🟢',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  Occasional: {
    icon: '🟡',
    className: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  Inactive: {
    icon: '🔴',
    className: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  Shifted: {
    icon: '⚫',
    className: 'bg-zinc-100 text-zinc-700 border-zinc-300'
  }
};

export const DEFAULT_STATUS_ICON = '💬';
export const DEFAULT_STATUS_ICON_MAP: Readonly<Record<string, string>> = {
  Response: '✏️',
  Connected: '📞',
  Busy: '⏳',
  'No Answer': '🔕',
  Interested: '✅',
  Registered: '🎟️',
  'Not Interested': '⛔',
  Reached: '📲',
  'Will Attend': '🙌',
  Maybe: '🤔',
  'Not Available': '🚫',
  'Call Back': '🔁'
};

export const DEFAULT_CAMPAIGN_MESSAGE = 'Hi {name}, greetings from Art of Living.';
export const DEFAULT_WHATSAPP_COUNTRY_CODE = '91';
export const DEFAULT_CENTER_WHATSAPP_NUMBER = '918884560660';

const DEFAULT_UI_BY_TYPE: Readonly<Record<CampaignType, CampaignUiMeta>> = {
  Members: {
    queueTitle: 'Participants Queue',
    filterOptions: [
      { id: 'all', label: 'All Members' },
      { id: 'active', label: 'Active' },
      { id: 'followup_today', label: 'Follow-up Today' },
      { id: 'callback', label: 'Call Back' }
    ]
  },
  Leads: {
    queueTitle: 'Leads Queue',
    filterOptions: [
      { id: 'all', label: 'All Leads' },
      { id: 'hot', label: 'Hot' },
      { id: 'followup_today', label: 'Follow-up Today' },
      { id: 'no_answer', label: 'No Answer' }
    ]
  }
};

export function getDefaultQualityOptionsForCampaignType(
  campaignType: CampaignType
): string[] {
  return [...DEFAULT_QUALITY_OPTIONS_BY_TYPE[campaignType]];
}

export function getDefaultStatusOptionsForCampaignType(
  campaignType: CampaignType
): string[] {
  return [...DEFAULT_STATUS_OPTIONS_BY_TYPE[campaignType]];
}

export function getDefaultCampaignUiMeta(campaignType: CampaignType): CampaignUiMeta {
  const value = DEFAULT_UI_BY_TYPE[campaignType];
  return {
    queueTitle: value.queueTitle,
    filterOptions: value.filterOptions.map((option) => ({ ...option }))
  };
}

export function getDefaultPrograms(): Program[] {
  return DEFAULT_PROGRAMS.map((program) => ({ ...program }));
}

export function createDefaultAppConfig(): AppConfig {
  return {
    campaigns: [],
    volunteers: [],
    programs: [],
    programDisplayOrder: [],
    showDonePrograms: true,
    uiByType: {},
    qualityMetaMap: {},
    statusIconMap: {},
    defaultStatusIcon: DEFAULT_STATUS_ICON,
    defaultCampaignMessage: DEFAULT_CAMPAIGN_MESSAGE,
    whatsappCountryCode: DEFAULT_WHATSAPP_COUNTRY_CODE,
    centerWhatsappNumber: DEFAULT_CENTER_WHATSAPP_NUMBER
  };
}
