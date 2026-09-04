import type { AuthProvider, CourseRepository, LeadRepository } from './contracts';
import {
  AssignMembersRequestSchema,
  AssignMembersResponseSchema,
  AuthenticatedUserSchema,
  BootstrapResponseSchema,
  CreateCourseRequestSchema,
  CreateCourseResponseSchema,
  CreateLeadRequestSchema,
  CreateLeadResponseSchema,
  DeleteCourseRequestSchema,
  DeleteCourseResponseSchema,
  DeleteLeadRequestSchema,
  DeleteLeadResponseSchema,
  ListCoursesResponseSchema,
  UpdateCourseRequestSchema,
  UpdateCourseResponseSchema,
  UpdateLeadRequestSchema,
  UpdateLeadResponseSchema,
  type AssignMembersRequest,
  type AssignMembersResponse,
  type AuthenticatedUser,
  type BootstrapResponse,
  type CreateCourseRequest,
  type CreateCourseResponse,
  type CreateLeadRequest,
  type CreateLeadResponse,
  type DeleteCourseRequest,
  type DeleteCourseResponse,
  type DeleteLeadRequest,
  type DeleteLeadResponse,
  type ListCoursesResponse,
  type UpdateCourseRequest,
  type UpdateCourseResponse,
  type UpdateLeadRequest,
  type UpdateLeadResponse
} from '../../shared/contracts/appContracts';
import { ApiClient } from '../services/apiClient';

export class HttpAuthProvider implements AuthProvider {
  constructor(private readonly apiClient: ApiClient) {}

  async getSessionUser(): Promise<AuthenticatedUser | null> {
    const response = await this.apiClient.get<{ user?: unknown }>(
      '/api/seva/auth/session'
    );
    if (!response.user) {
      return null;
    }
    return AuthenticatedUserSchema.parse(response.user);
  }

  async signIn(): Promise<AuthenticatedUser> {
    if (typeof window !== 'undefined') {
      window.location.assign('/api/seva/auth/signin');
    }

    return new Promise<AuthenticatedUser>(() => {
      // OAuth sign-in redirects the browser and this promise never resolves in-page.
    });
  }

  async signOut(): Promise<void> {
    await this.apiClient.post('/api/seva/auth/signout', {});
  }
}

export class HttpLeadRepository implements LeadRepository {
  constructor(private readonly apiClient: ApiClient) {}

  async getBootstrap(campaignId?: string | null): Promise<BootstrapResponse> {
    const query = campaignId ? '?campaignId=' + encodeURIComponent(campaignId) : '';
    const response = await this.apiClient.get<unknown>('/api/seva/bootstrap' + query);
    return BootstrapResponseSchema.parse(response);
  }

  async assignMembers(payload: AssignMembersRequest): Promise<AssignMembersResponse> {
    const parsed = AssignMembersRequestSchema.parse(payload);
    const response = await this.apiClient.post<unknown>(
      '/api/seva/leads/assign',
      parsed
    );
    return AssignMembersResponseSchema.parse(response);
  }

  async updateLead(payload: UpdateLeadRequest): Promise<UpdateLeadResponse> {
    const parsed = UpdateLeadRequestSchema.parse(payload);
    const response = await this.apiClient.put<unknown>(
      '/api/seva/leads/' + encodeURIComponent(parsed.id),
      parsed
    );
    return UpdateLeadResponseSchema.parse(response);
  }

  async createLead(payload: CreateLeadRequest): Promise<CreateLeadResponse> {
    const parsed = CreateLeadRequestSchema.parse(payload);
    const response = await this.apiClient.post<unknown>('/api/seva/leads', parsed);
    return CreateLeadResponseSchema.parse(response);
  }

  async deleteLead(payload: DeleteLeadRequest): Promise<DeleteLeadResponse> {
    const parsed = DeleteLeadRequestSchema.parse(payload);
    const response = await this.apiClient.delete<unknown>(
      '/api/seva/leads/' + encodeURIComponent(parsed.id),
      parsed
    );
    return DeleteLeadResponseSchema.parse(response);
  }
}

export class HttpCourseRepository implements CourseRepository {
  constructor(private readonly apiClient: ApiClient) {}

  async listCourses(): Promise<ListCoursesResponse> {
    const response = await this.apiClient.get<unknown>('/api/seva/courses');
    return ListCoursesResponseSchema.parse(response);
  }

  async createCourse(payload: CreateCourseRequest): Promise<CreateCourseResponse> {
    const parsed = CreateCourseRequestSchema.parse(payload);
    const response = await this.apiClient.post<unknown>('/api/seva/courses', parsed);
    return CreateCourseResponseSchema.parse(response);
  }

  async updateCourse(payload: UpdateCourseRequest): Promise<UpdateCourseResponse> {
    const parsed = UpdateCourseRequestSchema.parse(payload);
    const response = await this.apiClient.put<unknown>(
      '/api/seva/courses/' + encodeURIComponent(parsed.id),
      parsed
    );
    return UpdateCourseResponseSchema.parse(response);
  }

  async deleteCourse(payload: DeleteCourseRequest): Promise<DeleteCourseResponse> {
    const parsed = DeleteCourseRequestSchema.parse(payload);
    const response = await this.apiClient.delete<unknown>(
      '/api/seva/courses/' + encodeURIComponent(parsed.id),
      parsed
    );
    return DeleteCourseResponseSchema.parse(response);
  }
}
