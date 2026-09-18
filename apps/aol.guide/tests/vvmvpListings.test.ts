import { describe, expect, it } from 'vitest';
import {
  parseVvmvpBangalorePage,
  presentVvmvpCategories,
  vvmvpCategoryLabel
} from '../lib/sources/vvmvpListings.js';
import { sampleVvmvpEvent, sampleVvmvpPageHtml } from './helpers.js';

describe('VVMVP Bangalore listings', () => {
  it('keeps Bangalore events and hides empty VVMVP categories', () => {
    const page = parseVvmvpBangalorePage(sampleVvmvpPageHtml());
    expect(page.listings.map((listing) => listing.title)).toEqual([
      'Sahaj Samadhi Dhyan Yoga (18 - 20 September 2026)',
      'Weekly 4 Days AMP (24 - 27 September 2026)',
      'Intuition Process for Teens',
      'Online Home-Grown Home Cooked',
      'Guru Puja'
    ]);
    expect(page.categories).toEqual([
      'Advanced Programs',
      'Beginner Programs',
      'Children and Teens',
      'Online Programs',
      'Guru Puja Programs'
    ]);
    expect(page.categories).not.toContain('Health');
    expect(
      presentVvmvpCategories(page.listings, [
        { category: 'Health' },
        { category: 'Beginner Programs' },
        { category: 'Advanced Programs' }
      ])
    ).toEqual([
      'Beginner Programs',
      'Advanced Programs',
      'Children and Teens',
      'Online Programs',
      'Guru Puja Programs'
    ]);
  });

  it('uses official event and donate paths from list-event.js', () => {
    const page = parseVvmvpBangalorePage(sampleVvmvpPageHtml());
    const beginner = page.listings.find((listing) => listing.id === '4134');
    const donate = page.listings.find((listing) => listing.id === '99');
    const online = page.listings.find((listing) => listing.id === '4400');
    expect(beginner).toMatchObject({
      category: 'Beginner Programs',
      location: 'Bangalore Ashram, Bangalore, Karnataka',
      isOnline: false,
      languages: ['English', 'Hindi'],
      schedule: '18th to 20th Sep, 2026',
      registerUrl: 'https://programs.vvmvp.org/events/4134'
    });
    expect(donate?.registerUrl).toBe('https://programs.vvmvp.org/donate/99');
    expect(online).toMatchObject({
      category: 'Online Programs',
      isOnline: true,
      location: 'Online'
    });
  });

  it('drops events from other ashrams even when they share a category', () => {
    const page = parseVvmvpBangalorePage(
      sampleVvmvpPageHtml([
        sampleVvmvpEvent({
          id: '1',
          name: 'Bangalore HP',
          ashram_id: '1',
          slug: 'bangalore'
        }),
        sampleVvmvpEvent({
          id: '2',
          name: 'Vasad HP',
          ashram_id: '2',
          slug: 'vasad'
        })
      ])
    );
    expect(page.listings.map((listing) => listing.title)).toEqual(['Bangalore HP']);
  });

  it('drops Programs from chip labels', () => {
    expect(vvmvpCategoryLabel('Beginner Programs')).toBe('Beginner');
    expect(vvmvpCategoryLabel('Advanced Programs')).toBe('Advanced');
    expect(vvmvpCategoryLabel('Guru Puja Programs')).toBe('Guru Puja');
    expect(vvmvpCategoryLabel('Online Programs')).toBe('Online');
    expect(vvmvpCategoryLabel('Children and Teens')).toBe('Children and Teens');
  });
});
