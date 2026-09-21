import { findCourseAliasByCode } from './courseAliases.js';

export const ONLINE_PROGRAM_IDS = [
  'AMP',
  'SSY_DEEP_DIVE',
  'SPEED_READING',
  'OMBW',
  'SSY',
  'SSDY',
  'DEEP_SLEEP'
] as const;

export type OnlineProgramId = (typeof ONLINE_PROGRAM_IDS)[number];

export type OnlineProgram = {
  id: OnlineProgramId;
  label: string;
  shortLabel: string;
};

export const ONLINE_PROGRAMS: readonly OnlineProgram[] = [
  { id: 'SPEED_READING', label: '10x Speed Reading Program', shortLabel: '10x' },
  { id: 'AMP', label: 'Advanced Meditation Program', shortLabel: 'AMP' },
  { id: 'DEEP_SLEEP', label: 'Deep Sleep and Anxiety Relief', shortLabel: 'Deep Sleep' },
  {
    id: 'OMBW',
    label: 'Online Meditation and Breath Workshop',
    shortLabel: 'OMBW'
  },
  { id: 'SSDY', label: 'Sahaj Samadhi Meditation', shortLabel: 'Sahaj' },
  { id: 'SSY', label: 'Sri Sri Yoga Classes', shortLabel: 'Yoga' },
  { id: 'SSY_DEEP_DIVE', label: 'Sri Sri Yoga Deep Dive', shortLabel: 'Deep Dive' }
];

const ONLINE_PROGRAM_BY_ID = new Map(
  ONLINE_PROGRAMS.map((program) => [program.id, program])
);

export function parseOnlineProgramId(value: unknown): OnlineProgramId | undefined {
  return ONLINE_PROGRAM_IDS.includes(value as OnlineProgramId)
    ? (value as OnlineProgramId)
    : undefined;
}

export function onlineProgramLabel(id: OnlineProgramId): string {
  return ONLINE_PROGRAM_BY_ID.get(id)?.label || id;
}

export function onlineProgramShortLabel(id: OnlineProgramId): string {
  return ONLINE_PROGRAM_BY_ID.get(id)?.shortLabel || id;
}

export function onlineProgramTypeIds(id: OnlineProgramId): string[] {
  return [...(findCourseAliasByCode(id)?.typeIds || [])];
}
