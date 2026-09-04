import {
  AssignMembersRequestSchema,
  CreateCourseRequestSchema,
  CreateLeadRequestSchema,
  DeleteCourseRequestSchema,
  DeleteLeadRequestSchema,
  UpdateCourseRequestSchema,
  UpdateLeadRequestSchema
} from '../../shared/contracts/appContracts.js';
import {
  assignMembersToUser as assignMockMembersToUser,
  createCourseForUser as createMockCourseForUser,
  createLeadForUser as createMockLeadForUser,
  deleteCourseForUser as deleteMockCourseForUser,
  deleteLeadForUser as deleteMockLeadForUser,
  getBootstrapForUser as getMockBootstrapForUser,
  getPublicCourses as getMockPublicCourses,
  getShortUrlDestination as getMockShortUrlDestination,
  isUserAllowed as isMockUserAllowed,
  listCoursesForUser as listMockCoursesForUser,
  listPublicHomepageOffers as listMockPublicHomepageOffers,
  updateCourseForUser as updateMockCourseForUser,
  updateLeadForUser as updateMockLeadForUser
} from './mockStore.js';
import type { ApiDataStore } from './dataStore.js';

export const mockDataStore: ApiDataStore = {
  async authorizeUser(user) {
    return { allowed: isMockUserAllowed(user.email) };
  },

  async isUserAllowed(user) {
    return isMockUserAllowed(user.email);
  },

  async getBootstrapForAuthorizedUser(user, campaignId) {
    if (!isMockUserAllowed(user.email)) {
      return { allowed: false };
    }
    return {
      allowed: true,
      value: await getMockBootstrapForUser(user, campaignId)
    };
  },

  async assignMembersForAuthorizedUser(user, payload) {
    if (!isMockUserAllowed(user.email)) {
      return { allowed: false };
    }
    return {
      allowed: true,
      value: await assignMockMembersToUser(
        user,
        AssignMembersRequestSchema.parse(payload)
      )
    };
  },

  async createLeadForAuthorizedUser(user, payload) {
    if (!isMockUserAllowed(user.email)) {
      return { allowed: false };
    }
    return {
      allowed: true,
      value: await createMockLeadForUser(user, CreateLeadRequestSchema.parse(payload))
    };
  },

  async updateLeadForAuthorizedUser(user, payload) {
    if (!isMockUserAllowed(user.email)) {
      return { allowed: false };
    }
    return {
      allowed: true,
      value: await updateMockLeadForUser(user, UpdateLeadRequestSchema.parse(payload))
    };
  },

  async deleteLeadForAuthorizedUser(user, payload) {
    if (!isMockUserAllowed(user.email)) {
      return { allowed: false };
    }
    return {
      allowed: true,
      value: await deleteMockLeadForUser(user, DeleteLeadRequestSchema.parse(payload))
    };
  },

  async listCoursesForAuthorizedUser(user) {
    if (!isMockUserAllowed(user.email)) {
      return { allowed: false };
    }
    return { allowed: true, value: await listMockCoursesForUser() };
  },

  async createCourseForAuthorizedUser(user, payload) {
    if (!isMockUserAllowed(user.email)) {
      return { allowed: false };
    }
    return {
      allowed: true,
      value: await createMockCourseForUser(
        user,
        CreateCourseRequestSchema.parse(payload)
      )
    };
  },

  async updateCourseForAuthorizedUser(user, payload) {
    if (!isMockUserAllowed(user.email)) {
      return { allowed: false };
    }
    return {
      allowed: true,
      value: await updateMockCourseForUser(
        user,
        UpdateCourseRequestSchema.parse(payload)
      )
    };
  },

  async deleteCourseForAuthorizedUser(user, payload) {
    if (!isMockUserAllowed(user.email)) {
      return { allowed: false };
    }
    return {
      allowed: true,
      value: await deleteMockCourseForUser(DeleteCourseRequestSchema.parse(payload))
    };
  },

  async getPublicCourses(programKey) {
    return getMockPublicCourses(programKey);
  },

  async getShortUrlDestination(slug) {
    return getMockShortUrlDestination(slug);
  },

  async listPublicHomepageOffers() {
    return listMockPublicHomepageOffers();
  }
};
