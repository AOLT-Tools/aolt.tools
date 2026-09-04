import type { SevaWorkspaceContext, Lead, LeadSnapshot } from './types';
import type { Course, UpdateLeadRequest } from '../../../shared/contracts/appContracts';
import { DEFAULT_WHATSAPP_COUNTRY_CODE } from '../../config/campaignDefaults';
import {
  formatActivityTitle,
  isEventActivity
} from '../../../shared/contracts/courseDefaults.mjs';
import { fillCourseWhatsappTemplate } from '../../../shared/contracts/courseMatching';

const FALLBACK_COURSE_WHATSAPP_TEMPLATE = 'Hi {name}, you are invited to {course}.';
const FALLBACK_EVENT_WHATSAPP_TEMPLATE =
  'Hi {name}, you are invited to {course}.\n\nPlease reply here for details.';

function compactMessage(message: string): string {
  return String(message || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function createCommunicationMethods() {
  return {
    getTelHref(this: SevaWorkspaceContext, phone: string): string {
      const input = String(phone || '').trim();
      const hasPlus = input.startsWith('+');
      const digits = this.cleanPhone(input);
      if (!digits) {
        return '';
      }
      return 'tel:' + (hasPlus ? '+' : '') + digits;
    },
    dialLead(this: SevaWorkspaceContext, lead: Lead): void {
      const telHref = this.getTelHref(lead.mobile);
      if (!telHref) {
        return;
      }
      window.location.href = telHref;
    },
    getWhatsappDestination(this: SevaWorkspaceContext, lead: Lead): string {
      const mobile = String(lead.mobile || '').trim();
      const phone = this.cleanPhone(mobile);
      if (!phone) {
        return '';
      }
      const countryCode =
        this.cleanPhone(
          String(this.appConfig.whatsappCountryCode || DEFAULT_WHATSAPP_COUNTRY_CODE)
        ) || DEFAULT_WHATSAPP_COUNTRY_CODE;
      return mobile.startsWith('+') ||
        (phone.length > 10 && phone.startsWith(countryCode))
        ? phone
        : countryCode + phone;
    },
    canOpenWhatsapp(this: SevaWorkspaceContext, lead: Lead): boolean {
      return Boolean(this.getWhatsappDestination(lead));
    },
    buildWhatsappHref(
      this: SevaWorkspaceContext,
      lead: Lead,
      course?: Course | null
    ): string {
      const destination = this.getWhatsappDestination(lead);
      if (!destination) {
        return '';
      }
      let message = '';
      if (course) {
        if (isEventActivity(course)) {
          message = compactMessage(
            fillCourseWhatsappTemplate(
              course.whatsappTemplate || FALLBACK_EVENT_WHATSAPP_TEMPLATE,
              {
                name: lead.name || 'Friend',
                course: formatActivityTitle(course),
                dates: '',
                registrationLink: ''
              }
            )
          );
        } else {
          message = compactMessage(
            fillCourseWhatsappTemplate(
              course.whatsappTemplate || FALLBACK_COURSE_WHATSAPP_TEMPLATE,
              {
                name: lead.name || 'Friend',
                course: course.title || '',
                dates: '',
                registrationLink: ''
              }
            )
          );
        }
      }
      const encoded = encodeURIComponent(message);
      return 'https://wa.me/' + destination + (encoded ? '?text=' + encoded : '');
    },
    async saveLead(
      this: SevaWorkspaceContext,
      lead: Lead,
      snapshot: LeadSnapshot = this.createLeadSnapshot(lead)
    ): Promise<string> {
      const payload: UpdateLeadRequest = {
        id: String(lead.id || ''),
        name: snapshot.name,
        status: snapshot.status,
        quality: snapshot.quality,
        followUp: snapshot.followUp,
        notes: snapshot.notes,
        campaignId: lead.campaignId,
        campaignType: lead.campaignType,
        wishlistPrograms: this.getProgramListForSave(snapshot.wishlistPrograms),
        donePrograms: this.getProgramListForSave(snapshot.donePrograms)
      };

      const response = await window.appRuntime.updateLead(payload);
      return response.lead.lastUpdated || 'Just now';
    }
  };
}
