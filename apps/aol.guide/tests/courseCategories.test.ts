import { describe, expect, it } from 'vitest';
import {
  COURSE_FILTER_ORDER,
  categorizeCourse,
  nextAolRadiusKm
} from '../lib/courseCategories.js';

describe('course categories', () => {
  it('puts Beginner first and All last', () => {
    expect(COURSE_FILTER_ORDER[0]).toBe('beginner');
    expect(COURSE_FILTER_ORDER.at(-1)).toBe('all');
  });

  it('maps Happiness Program to Beginner', () => {
    expect(categorizeCourse({ courseTypeId: '74889', title: 'Happiness Program' })).toBe(
      'beginner'
    );
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

  it('expands the in-person radius ladder from 3 km', () => {
    expect(nextAolRadiusKm(3)).toBe(10);
    expect(nextAolRadiusKm(10)).toBe(25);
    expect(nextAolRadiusKm(25)).toBe(50);
    expect(nextAolRadiusKm(50)).toBeUndefined();
  });
});
