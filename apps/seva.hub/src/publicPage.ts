import Alpine from '@alpinejs/csp';
import './main.css';
import {
  DEFAULT_CENTER_WHATSAPP_NUMBER,
  homepageProgramOffers
} from '../shared/contracts/courseDefaults.mjs';
import { homepageCta } from './features/public/homepageOffers';

declare global {
  interface Window {
    Alpine: typeof Alpine;
  }
}

type CatalogOffer = {
  code: string;
  label: string;
  active: boolean;
  registerPath: string;
};

function homepagePrograms() {
  return {
    offers: homepageProgramOffers([]) as CatalogOffer[],
    whatsappNumber: DEFAULT_CENTER_WHATSAPP_NUMBER,
    cta(code: string) {
      const offer = this.offers.find((item: CatalogOffer) => item.code === code) || {
        code,
        label: code,
        active: false,
        registerPath: ''
      };
      return homepageCta(offer, this.whatsappNumber);
    },
    centerWhatsappHref(text = '') {
      const number =
        String(this.whatsappNumber || '').replace(/\D/g, '') ||
        DEFAULT_CENTER_WHATSAPP_NUMBER;
      const message = String(text || '').trim();
      return message
        ? 'https://wa.me/' + number + '?text=' + encodeURIComponent(message)
        : 'https://wa.me/' + number;
    },
    async init() {
      try {
        const response = await fetch('/api/seva/courses?catalog=1');
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as {
          offers?: CatalogOffer[];
          whatsappNumber?: string;
        };
        if (body.whatsappNumber) {
          this.whatsappNumber = body.whatsappNumber;
        }
        if (!Array.isArray(body.offers)) {
          return;
        }
        const byCode: Record<string, CatalogOffer> = {};
        for (const offer of body.offers) {
          if (offer?.code) {
            byCode[offer.code] = offer;
          }
        }
        this.offers = this.offers.map(
          (offer: CatalogOffer) => byCode[offer.code] || offer
        );
      } catch {
        // Keep Know More defaults when the catalog is unavailable.
      }
    }
  };
}

function initializeProgramSlider(): void {
  const slider = document.getElementById('programSlider');
  const previous = document.getElementById('prevProgram');
  const next = document.getElementById('nextProgram');

  if (!slider || !previous || !next) {
    return;
  }

  const step = () => Math.max(170, Math.round(slider.clientWidth * 0.48));

  previous.addEventListener('click', () => {
    slider.scrollBy({ left: -step(), behavior: 'smooth' });
  });

  next.addEventListener('click', () => {
    slider.scrollBy({ left: step(), behavior: 'smooth' });
  });
}

function initializeMenuSheet(): void {
  const sheet = document.getElementById('menuSheet');
  const menuButton = document.getElementById('menuButton');
  const moreButton = document.getElementById('moreButton');
  const closeMenu = document.getElementById('closeMenu');

  if (!sheet || !menuButton || !moreButton || !closeMenu) {
    return;
  }

  const setMenu = (open: boolean) => {
    sheet.classList.toggle('open', open);
    sheet.setAttribute('aria-hidden', String(!open));
    menuButton.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };

  menuButton.addEventListener('click', () => setMenu(true));
  moreButton.addEventListener('click', () => setMenu(true));
  closeMenu.addEventListener('click', () => setMenu(false));
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) {
      setMenu(false);
    }
  });
  sheet.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', () => setMenu(false));
  });
}

function initializeScheduleFilters(): void {
  const scheduleTabs = document.querySelectorAll<HTMLButtonElement>('.schedule-tab');
  const scheduleItems = document.querySelectorAll<HTMLElement>('.schedule-item');

  const filterSchedule = (filter: string) => {
    scheduleTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    scheduleItems.forEach((item) => {
      item.style.display =
        filter === 'all' || item.dataset.category === filter ? '' : 'none';
    });
  };

  scheduleTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      filterSchedule(tab.dataset.filter || 'all');
    });
  });
  document.querySelectorAll<HTMLElement>('[data-schedule-target]').forEach((link) => {
    link.addEventListener('click', () => {
      filterSchedule(link.dataset.scheduleTarget || 'all');
    });
  });
}

function initializePublicPageInteractions(): void {
  initializeProgramSlider();
  initializeMenuSheet();
  initializeScheduleFilters();
}

window.Alpine = Alpine;
Alpine.data('homepagePrograms', homepagePrograms);
initializePublicPageInteractions();
Alpine.start();
