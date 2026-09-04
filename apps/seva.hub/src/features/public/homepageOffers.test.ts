import { describe, expect, it } from 'vitest';
import { DEFAULT_CENTER_WHATSAPP_NUMBER } from '../../../shared/contracts/courseDefaults.mjs';
import { homepageCta, knowMoreHref } from './homepageOffers';

describe('homepage program CTAs', () => {
  it('sends Register Now to the public course path when the offer is active', () => {
    expect(
      homepageCta({
        active: true,
        registerPath: '/courses?program=hp',
        label: 'Happiness Program',
        code: 'HP'
      })
    ).toEqual({
      href: '/courses?program=hp',
      label: 'Register Now',
      external: false
    });
  });

  it('sends a WhatsApp Know More message when the offer is not active', () => {
    const cta = homepageCta({
      active: false,
      registerPath: '/courses?program=ip',
      label: 'Intuition Program',
      code: 'IP'
    });
    expect(cta.label).toBe('Know More');
    expect(cta.external).toBe(true);
    expect(cta.href).toBe(knowMoreHref('Intuition Program'));
    expect(cta.href).toContain('https://wa.me/' + DEFAULT_CENTER_WHATSAPP_NUMBER);
    expect(decodeURIComponent(cta.href)).toContain('Intuition Program');
  });

  it('uses the configured center WhatsApp number for Know More', () => {
    const cta = homepageCta(
      {
        active: false,
        label: 'Happiness Program'
      },
      '919999999999'
    );

    expect(cta.href).toContain('https://wa.me/919999999999');
  });
});
