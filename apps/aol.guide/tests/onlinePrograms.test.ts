import { describe, expect, it } from 'vitest';
import { findCourseAliasByCode } from '../lib/courseAliases.js';
import {
  ONLINE_PROGRAMS,
  onlineProgramLabel,
  onlineProgramShortLabel,
  onlineProgramTypeIds,
  parseOnlineProgramId
} from '../lib/onlinePrograms.js';

describe('online program catalog', () => {
  it('lists the selectable online programs in display order', () => {
    expect(ONLINE_PROGRAMS.map((program) => program.label)).toEqual([
      '10x Speed Reading Program',
      'Advanced Meditation Program',
      'Deep Sleep and Anxiety Relief',
      'Online Meditation and Breath Workshop',
      'Sahaj Samadhi Meditation',
      'Sri Sri Yoga Classes',
      'Sri Sri Yoga Deep Dive'
    ]);
    expect(ONLINE_PROGRAMS.map((program) => program.shortLabel)).toEqual([
      '10x',
      'AMP',
      'Deep Sleep',
      'OMBW',
      'Sahaj',
      'Yoga',
      'Deep Dive'
    ]);
  });

  it('maps each program to official course type ids', () => {
    expect(parseOnlineProgramId('OMBW')).toBe('OMBW');
    expect(onlineProgramLabel('OMBW')).toBe(
      'Online Meditation and Breath Workshop'
    );
    expect(findCourseAliasByCode('OMBW')?.label).toBe(
      'Online Meditation and Breath Workshop'
    );
    expect(parseOnlineProgramId('yoga')).toBeUndefined();
    expect(onlineProgramLabel('SSDY')).toBe('Sahaj Samadhi Meditation');
    expect(onlineProgramShortLabel('SSDY')).toBe('Sahaj');
    expect(onlineProgramTypeIds('AMP')).toEqual(
      expect.arrayContaining(['814381', '22119'])
    );
    expect(onlineProgramTypeIds('OMBW')).toEqual(['338000', '337993']);
    expect(onlineProgramTypeIds('SSY')).toEqual(
      expect.arrayContaining(['337981', '532059', '12410'])
    );
    expect(onlineProgramTypeIds('SSY')).not.toContain('368348');
    expect(onlineProgramTypeIds('SSY_DEEP_DIVE')).toEqual(
      expect.arrayContaining(['368348', '55113', '337995'])
    );
    expect(onlineProgramTypeIds('SSDY')).toEqual(
      expect.arrayContaining(['339715'])
    );
    expect(onlineProgramTypeIds('SPEED_READING')).toEqual(['1677263']);
    expect(onlineProgramTypeIds('DEEP_SLEEP')).toEqual(
      expect.arrayContaining(['346148', '1488895'])
    );
    expect(findCourseAliasByCode('DEEP_SLEEP')?.label).toBe(
      'Deep Sleep and Anxiety Relief'
    );
  });
});
