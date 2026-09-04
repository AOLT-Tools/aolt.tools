import { describe, expect, it } from 'vitest';
import { parseSearchQuery, normalizeExternalIntent } from '../lib/queryParser.js';

const now = new Date('2026-09-04T06:30:00.000Z');

describe('deterministic search intent parser', () => {
  it('parses HP 560045', () => {
    const intent = parseSearchQuery('HP 560045', { now });
    expect(intent).toMatchObject({
      courseCode: 'HP',
      courseLabel: 'Happiness Program',
      pincode: '560045',
      confidence: 'high'
    });
    expect(intent.courseTypeIds).toContain('313040');
    expect(intent.radiusKm).toBeUndefined();
  });

  it('parses HP near 560045 within 10km', () => {
    const intent = parseSearchQuery('HP near 560045 within 10km', { now });
    expect(intent).toMatchObject({
      courseCode: 'HP',
      pincode: '560045',
      radiusKm: 10
    });
    expect(intent.city?.toLowerCase() || '').not.toContain('within');
  });

  it.each([
    ['HP 560045 5km', 5],
    ['HP 560045 5 km', 5],
    ['HP 560045 5 kms', 5],
    ['HP 560045 5 kilometers', 5],
    ['HP near 560045 within 10km', 10],
    ['HP near 560045 within 10 km', 10],
    ['HP 560045 under 15 km', 15],
    ['Intuition near 560001 within 20km', 20]
  ] as const)('parses radius from %s', (query, radiusKm) => {
    const intent = parseSearchQuery(query, { now });
    expect(intent.radiusKm).toBe(radiusKm);
    expect(intent.pincode).toMatch(/56\d{4}/);
  });

  it('parses HP 560045 Hindi this weekend', () => {
    const intent = parseSearchQuery('HP 560045 Hindi this weekend', { now });
    expect(intent).toMatchObject({
      courseCode: 'HP',
      pincode: '560045',
      language: 'Hindi',
      dateFrom: '2026-09-05',
      dateTo: '2026-09-06',
      dateLabel: 'This weekend'
    });
  });

  it('parses AMP Bangalore Ashram next weekend', () => {
    const intent = parseSearchQuery('AMP Bangalore Ashram next weekend', { now });
    expect(intent).toMatchObject({
      courseCode: 'AMP',
      courseLabel: 'Advanced Meditation Program',
      ashramMentioned: true,
      dateFrom: '2026-09-12',
      dateTo: '2026-09-13',
      dateLabel: 'Next weekend'
    });
  });

  it('parses Rudra Puja this weekend', () => {
    const intent = parseSearchQuery('Rudra Puja this weekend', { now });
    expect(intent.eventType).toBe('puja');
    expect(intent.vdsMentioned).toBe(true);
    expect(intent.dateLabel).toBe('This weekend');
    expect(intent.keywords || []).toEqual(expect.arrayContaining(['rudra']));
    expect(intent.city).toBeUndefined();
  });

  it('parses HP online', () => {
    expect(parseSearchQuery('HP online', { now }).deliveryMode).toBe('online');
  });

  it('parses a teacher query with ashram', () => {
    const intent = parseSearchQuery('teacher Alex Bangalore Ashram', { now });
    expect(intent.teacher).toBe('Alex');
    expect(intent.ashramMentioned).toBe(true);
  });

  it('parses a teacher query near a PIN', () => {
    expect(parseSearchQuery('teacher Alex near 560045', { now }).teacher).toBe('Alex');
  });

  it('does not let Gemini overwrite an explicit radius', () => {
    const intent = normalizeExternalIntent(
      'HP near 560045 within 10km',
      {
        courseCode: 'HP',
        pincode: '560045',
        radiusKm: 25,
        city: 'within'
      },
      { now }
    );
    expect(intent.radiusKm).toBe(10);
    expect(intent.pincode).toBe('560045');
  });
});
