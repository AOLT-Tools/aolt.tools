import type {
  AuthenticatedUser,
  AssignMembersRequest,
  AssignMembersResponse,
  BootstrapResponse,
  CreateCourseRequest,
  CreateCourseResponse,
  CreateLeadRequest,
  CreateLeadResponse,
  DeleteCourseRequest,
  DeleteCourseResponse,
  DeleteLeadRequest,
  DeleteLeadResponse,
  ListCoursesResponse,
  UpdateCourseRequest,
  UpdateCourseResponse,
  UpdateLeadRequest,
  UpdateLeadResponse
} from '../../shared/contracts/appContracts';

export interface AuthProvider {
  getSessionUser(): Promise<AuthenticatedUser | null>;
  signIn(): Promise<AuthenticatedUser>;
  signOut(): Promise<void>;
}

export interface LeadRepository {
  getBootstrap(campaignId?: string | null): Promise<BootstrapResponse>;
  assignMembers(payload: AssignMembersRequest): Promise<AssignMembersResponse>;
  createLead(payload: CreateLeadRequest): Promise<CreateLeadResponse>;
  updateLead(payload: UpdateLeadRequest): Promise<UpdateLeadResponse>;
  deleteLead(payload: DeleteLeadRequest): Promise<DeleteLeadResponse>;
}

export interface CourseRepository {
  listCourses(): Promise<ListCoursesResponse>;
  createCourse(payload: CreateCourseRequest): Promise<CreateCourseResponse>;
  updateCourse(payload: UpdateCourseRequest): Promise<UpdateCourseResponse>;
  deleteCourse(payload: DeleteCourseRequest): Promise<DeleteCourseResponse>;
}
