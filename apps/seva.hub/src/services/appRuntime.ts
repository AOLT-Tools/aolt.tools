import { z } from 'zod';
import type {
  AuthProvider,
  CourseRepository,
  LeadRepository
} from '../repositories/contracts';
import {
  HttpAuthProvider,
  HttpCourseRepository,
  HttpLeadRepository
} from '../repositories/http';
import { ApiClient } from './apiClient';
import type {
  AssignMembersRequest,
  CreateCourseRequest,
  CreateLeadRequest,
  DeleteCourseRequest,
  DeleteLeadRequest,
  UpdateCourseRequest,
  UpdateLeadRequest
} from '../../shared/contracts/appContracts';

const EnvSchema = z.object({
  VITE_APP_MODE: z.enum(['mock', 'api']).default('mock'),
  VITE_API_BASE_URL: z.string().optional()
});

const env = EnvSchema.parse({
  VITE_APP_MODE: import.meta.env.VITE_APP_MODE,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL
});

const apiBaseUrl = env.VITE_API_BASE_URL || '';
const httpAuthProvider = new HttpAuthProvider(new ApiClient(apiBaseUrl));
const httpLeadRepository = new HttpLeadRepository(new ApiClient(apiBaseUrl));
const httpCourseRepository = new HttpCourseRepository(new ApiClient(apiBaseUrl));

let mockAuthProviderPromise: Promise<AuthProvider> | null = null;
let mockLeadRepositoryPromise: Promise<LeadRepository> | null = null;
let mockCourseRepositoryPromise: Promise<CourseRepository> | null = null;

async function getAuthProvider(): Promise<AuthProvider> {
  if (env.VITE_APP_MODE === 'api') {
    return httpAuthProvider;
  }
  if (!mockAuthProviderPromise) {
    mockAuthProviderPromise = import('../repositories/mock/mockAuthProvider').then(
      ({ MockAuthProvider }) => new MockAuthProvider()
    );
  }
  return mockAuthProviderPromise;
}

async function getLeadRepository(): Promise<LeadRepository> {
  if (env.VITE_APP_MODE === 'api') {
    return httpLeadRepository;
  }
  if (!mockLeadRepositoryPromise) {
    mockLeadRepositoryPromise = import('../repositories/mock/mockLeadRepository').then(
      ({ MockLeadRepository }) => new MockLeadRepository()
    );
  }
  return mockLeadRepositoryPromise;
}

async function getCourseRepository(): Promise<CourseRepository> {
  if (env.VITE_APP_MODE === 'api') {
    return httpCourseRepository;
  }
  if (!mockCourseRepositoryPromise) {
    mockCourseRepositoryPromise =
      import('../repositories/mock/mockCourseRepository').then(
        ({ MockCourseRepository }) => new MockCourseRepository()
      );
  }
  return mockCourseRepositoryPromise;
}

export const appRuntime = {
  async getAuthenticatedUser() {
    return (await getAuthProvider()).getSessionUser();
  },
  async signInWithGoogle() {
    return (await getAuthProvider()).signIn();
  },
  async signOut() {
    return (await getAuthProvider()).signOut();
  },
  async loadBootstrap(campaignId?: string | null) {
    return (await getLeadRepository()).getBootstrap(campaignId);
  },
  async assignMembers(payload: AssignMembersRequest) {
    return (await getLeadRepository()).assignMembers(payload);
  },
  async createLead(payload: CreateLeadRequest) {
    return (await getLeadRepository()).createLead(payload);
  },
  async updateLead(payload: UpdateLeadRequest) {
    return (await getLeadRepository()).updateLead(payload);
  },
  async deleteLead(payload: DeleteLeadRequest) {
    return (await getLeadRepository()).deleteLead(payload);
  },
  async listCourses() {
    return (await getCourseRepository()).listCourses();
  },
  async createCourse(payload: CreateCourseRequest) {
    return (await getCourseRepository()).createCourse(payload);
  },
  async updateCourse(payload: UpdateCourseRequest) {
    return (await getCourseRepository()).updateCourse(payload);
  },
  async deleteCourse(payload: DeleteCourseRequest) {
    return (await getCourseRepository()).deleteCourse(payload);
  }
};
