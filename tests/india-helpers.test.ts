import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  addCalendarDays,
  resolveDatePreset,
  todayInIndia,
  yearFromNow
} from '@aolt/core/dates';
import { isValidLatitude, isValidLongitude } from '@aolt/core/geo';
import { mergeLocalEnv, parseEnvFile, readLocalEnvFiles } from '@aolt/core/local-env';
import { normalizePincode } from '@aolt/core/normalization';

const FRIDAY_IN_INDIA = new Date('2026-09-04T06:30:00.000Z');

describe('Indian PIN helper', () => {
  it('extracts a 6-digit PIN that does not start with 0', () => {
    expect(normalizePincode('HP near 560045 within 10km')).toBe('560045');
    expect(normalizePincode('012345')).toBe('');
    expect(normalizePincode('')).toBe('');
  });
});

describe('geo validators', () => {
  it('accepts finite lat/lng ranges', () => {
    expect(isValidLatitude(13.04)).toBe(true);
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLongitude(77.62)).toBe(true);
    expect(isValidLongitude(-181)).toBe(false);
  });
});

describe('IST date helpers', () => {
  it('uses Asia/Kolkata for today and weekend presets', () => {
    expect(todayInIndia(FRIDAY_IN_INDIA)).toBe('2026-09-04');
    expect(resolveDatePreset('this_weekend', FRIDAY_IN_INDIA)).toEqual({
      start: '2026-09-05',
      end: '2026-09-06',
      label: 'This weekend'
    });
    expect(addCalendarDays('2026-09-04', 1)).toBe('2026-09-05');
    expect(yearFromNow(FRIDAY_IN_INDIA)).toBe('2027-09-04');
  });
});

describe('local env loader', () => {
  it('parses export, quotes, and comments', () => {
    expect(
      parseEnvFile(
        [
          '# comment',
          'export TOKEN=abc',
          'QUOTED="line\\nvalue"',
          "SINGLE='keep # hash'",
          'PLAIN=value # trailing',
          '1INVALID=no'
        ].join('\n')
      )
    ).toEqual({
      TOKEN: 'abc',
      QUOTED: 'line\nvalue',
      SINGLE: 'keep # hash',
      PLAIN: 'value'
    });
  });

  it('merges files then process.env', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aolt-env-'));
    const envKey = 'AOLT_TEST_SHARED_ENV';
    const previous = process.env[envKey];
    try {
      await writeFile(join(dir, '.env'), 'FROM_FILE=file\n' + envKey + '=file\n');
      await writeFile(
        join(dir, '.env.local'),
        'FROM_LOCAL=local\n' + envKey + '=local\n'
      );
      process.env[envKey] = 'process';
      expect(readLocalEnvFiles({ cwd: dir })).toMatchObject({
        FROM_FILE: 'file',
        FROM_LOCAL: 'local',
        [envKey]: 'local'
      });
      expect(mergeLocalEnv({ cwd: dir })[envKey]).toBe('process');
      expect(mergeLocalEnv({ cwd: dir }).FROM_LOCAL).toBe('local');
    } finally {
      if (previous === undefined) delete process.env[envKey];
      else process.env[envKey] = previous;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
