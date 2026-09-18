import { describe, expect, it } from 'vitest';
import {
  COURSE_FILTER_ORDER,
  categorizeCourse,
  courseCategoryLabel,
  nextAolRadiusKm,
  parseCourseCategories,
  presentCourseCategories,
  serializeCourseCategories
} from '../lib/courseCategories.js';

describe('course categories', () => {
  it('orders beginner first and has no All filter', () => {
    expect(COURSE_FILTER_ORDER[0]).toBe('beginner');
    expect(COURSE_FILTER_ORDER).not.toContain('all');
  });

  it('maps Happiness Program to Beginner', () => {
    expect(categorizeCourse({ courseTypeId: '74889', title: 'Happiness Program' })).toBe(
      'beginner'
    );
  });

  it('maps Sahaj Samadhi to Beginner', () => {
    expect(
      categorizeCourse({ courseTypeId: '339715', title: 'Sahaj Samadhi Dhyana Yoga' })
    ).toBe('beginner');
    expect(categorizeCourse({ title: 'Sahaj Samadhi Yoga' })).toBe('beginner');
  });

  it('maps Sri Sri Yoga to Yoga', () => {
    expect(categorizeCourse({ courseTypeId: '337981', title: 'Sri Sri Yoga' })).toBe('yoga');
  });

  it('maps Medha and Utkarsha to Kids', () => {
    expect(categorizeCourse({ courseTypeId: '622743', title: 'Medha Yoga' })).toBe('kids');
    expect(categorizeCourse({ courseTypeId: '602859', title: 'Utkarsha Yoga' })).toBe(
      'kids'
    );
  });

  it('maps Intuition kids titles to Kids and adult Intuition to Other', () => {
    expect(
      categorizeCourse({ courseTypeId: '377106', title: 'Intuition Process for Kids' })
    ).toBe('kids');
    expect(categorizeCourse({ courseTypeId: '377106', title: 'Intuition Process' })).toBe(
      'other'
    );
  });

  it('maps Volunteer Training with AMP into Advanced', () => {
    expect(
      categorizeCourse({ courseTypeId: '55116', title: 'Volunteer Training Program' })
    ).toBe('advanced');
    expect(categorizeCourse({ courseTypeId: '22119', title: 'AMP' })).toBe('advanced');
  });

  it('maps Follow Up and Satsang into Regular Connects', () => {
    expect(COURSE_FILTER_ORDER).toContain('regular_connects');
    expect(COURSE_FILTER_ORDER).not.toContain('follow_up');
    expect(courseCategoryLabel('regular_connects')).toBe('Regular Connects');
    expect(
      categorizeCourse({
        courseTypeId: '351956',
        title: 'Sudarshan Kriya Follow Up'
      })
    ).toBe('regular_connects');
    expect(categorizeCourse({ title: 'Weekly Satsang' })).toBe('regular_connects');
    expect(parseCourseCategories('follow_up,beginner')).toEqual([
      'beginner',
      'regular_connects'
    ]);
  });

  it('expands the in-person radius ladder from 3 km', () => {
    expect(nextAolRadiusKm(3)).toBe(10);
    expect(nextAolRadiusKm(10)).toBe(25);
    expect(nextAolRadiusKm(25)).toBe(50);
    expect(nextAolRadiusKm(50)).toBeUndefined();
  });

  it('serializes selected categories and omits missing ones', () => {
    expect(serializeCourseCategories(['kids', 'beginner'])).toBe('beginner,kids');
    expect(parseCourseCategories('beginner,all,kids,beginner')).toEqual([
      'beginner',
      'kids'
    ]);
    expect(presentCourseCategories([{ category: 'advanced' }, { category: 'beginner' }])).toEqual(
      ['beginner', 'advanced']
    );
  });
});
