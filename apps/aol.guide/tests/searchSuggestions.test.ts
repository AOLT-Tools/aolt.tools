import { describe, expect, it } from 'vitest';
import { getSearchSuggestions } from '../src/searchSuggestions.js';

describe('AOL Guide search suggestions', () => {
  it('suggests distance variants when a PIN is present', () => {
    expect(getSearchSuggestions('HP near 560045')).toEqual(
      expect.arrayContaining([
        'HP near 560045 within 5km',
        'HP near 560045 within 10km',
        'HP near 560045 within 25km'
      ])
    );
  });

  it('teaches ashram and puja syntax', () => {
    expect(getSearchSuggestions('AMP Bangalore')).toEqual(
      expect.arrayContaining(['AMP Bangalore Ashram next weekend'])
    );
    expect(getSearchSuggestions('Rudra')).toEqual(
      expect.arrayContaining(['Rudra Puja this weekend'])
    );
    expect(getSearchSuggestions('Intuition near 560001')).toEqual(
      expect.arrayContaining(['Intuition near 560001 within 10km'])
    );
  });

  it('suggests teacher queries the same way as program searches', () => {
    expect(getSearchSuggestions('teacher')).toEqual(
      expect.arrayContaining([
        'teacher near 560045',
        'teacher near 560045 within 5km',
        'teacher near 560045 within 10km',
        'teacher near 560045 within 25km'
      ])
    );
    expect(getSearchSuggestions('teacher Alex near 560045')).toEqual(
      expect.arrayContaining([
        'teacher Alex near 560045 within 5km',
        'teacher Alex near 560045 within 10km',
        'teacher Alex near 560045 within 25km'
      ])
    );
  });

  it('does not overwhelm the list', () => {
    expect(getSearchSuggestions('HP near 560045').length).toBeLessThanOrEqual(6);
    expect(getSearchSuggestions('teacher').length).toBeLessThanOrEqual(6);
  });
});
