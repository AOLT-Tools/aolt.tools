import type {
  AppConfig as ContractAppConfig,
  AuthenticatedUser as ContractAuthenticatedUser,
  Campaign as ContractCampaign,
  Course,
  CourseTemplate,
  Lead as ContractLead
} from '../../../shared/contracts/appContracts';

export type CampaignType = ContractCampaign['type'];
export type Campaign = ContractCampaign;
export type Program = ContractAppConfig['programs'][number];
export type AuthenticatedUser = ContractAuthenticatedUser;
export type CampaignUiMeta = NonNullable<ContractAppConfig['uiByType']>[string];
export type QualityMeta = NonNullable<ContractAppConfig['qualityMetaMap']>[string];

export interface OptionItem {
  value: string;
  label: string;
  icon?: string;
}

export interface ProgramDraft {
  wishlist: string[];
  done: string[];
}

export interface CourseDraft {
  id: string;
  activityType: 'Course' | 'Event';
  courseType: string;
  programCode: string;
  title: string;
  whatsappTemplate: string;
  isActive: boolean;
  hasImage: boolean;
  clearImage: boolean;
  imageBase64: string;
  imageMimeType: string;
  imagePreviewUrl: string;
}

export type WorkspaceView = 'callTracker' | 'courseManagement';
export type CoursePickerMode = 'whatsapp' | 'imageShare';
export type TextSize = 'normal' | 'large' | 'extraLarge';

export interface CreateRecordDraft {
  name: string;
  mobile: string;
  notes: string;
  campaignId: string;
}

export interface AssignMembersDraft {
  count: number;
  engagementLevels: string[];
}

export interface LeadSnapshot {
  name: string;
  quality: string;
  followUp: string;
  status: string;
  notes: string;
  wishlistPrograms: string[];
  donePrograms: string[];
}

export type Lead = Omit<
  ContractLead,
  'campaignId' | 'campaignType' | 'wishlistPrograms' | 'donePrograms'
> & {
  campaignId: string;
  campaignType: CampaignType;
  wishlistPrograms: string[];
  donePrograms: string[];
  programSummary: string;
  isEditingName: boolean;
  isDirty: boolean;
  _originalData: LeadSnapshot | null;
  _nameLower: string;
  _phoneRawLower: string;
  _phoneDigits: string;
  _followUpDate: Date | null;
  _followUpTs: number | null;
};

export interface StatusMeta {
  icon: string;
  label: string;
}

export type AppConfig = Omit<ContractAppConfig, 'id' | 'allowedUsers'> &
  Partial<Pick<ContractAppConfig, 'id' | 'allowedUsers'>>;

export interface SevaWorkspaceState {
  campaigns: Campaign[];
  selectedCampaignId: string;
  selectedCampaign: Campaign | null;
  campaignType: CampaignType;
  campaignMessage: string;
  leads: Lead[];
  selectedFilter: string;
  metricFilter: string;
  searchQuery: string;
  volunteerEmail: string;
  authenticatedUser: AuthenticatedUser | null;
  authError: string;
  actionMessage: string;
  isVolunteerModalOpen: boolean;
  filterOptions: Array<{ id: string; label: string }>;
  isFilterPanelOpen: boolean;
  isProfileMenuOpen: boolean;
  isOptionSheetOpen: boolean;
  optionSheetMode: string;
  optionSheetTitle: string;
  optionSheetOptions: OptionItem[];
  currentOptionValue: string;
  activeOptionLead: Lead | null;
  isFollowUpModalOpen: boolean;
  activeFollowUpLead: Lead | null;
  followUpDraft: string;
  isProgramEditorOpen: boolean;
  activeProgramLead: Lead | null;
  activeCardId: string;
  selectedIds: Set<string>;
  cardLongPressTimer: ReturnType<typeof setTimeout> | null;
  cardLongPressStart: { x: number; y: number } | null;
  suppressCardClickLeadId: string;
  isBulkActionPending: boolean;
  isFabOpen: boolean;
  isCreateRecordModalOpen: boolean;
  createRecordType: CampaignType;
  createRecordDraft: CreateRecordDraft;
  isCreateRecordSaving: boolean;
  globalPointerDownHandler: ((event: PointerEvent) => void) | null;
  programDraft: ProgramDraft;
  filteredCriteriaKey: string;
  programFilter: string;
  pageSize: number;
  visibleLeadLimit: number;
  dueFollowUpCount: number;
  upcomingFollowUpCount: number;
  qualityOptions: OptionItem[];
  statusOptions: string[];
  isLoadingBootstrap: boolean;
  isCampaignSwitching: boolean;
  isCampaignRefreshing: boolean;
  isAssignMembersModalOpen: boolean;
  assignMembersDraft: AssignMembersDraft;
  isAssigningMembers: boolean;
  qualityMetaMap: Record<string, QualityMeta>;
  defaultQualityMeta: QualityMeta;
  statusIconMap: Record<string, string>;
  defaultStatusIcon: string;
  programOrderMap: Record<string, number>;
  programCodeMap: Record<string, string>;
  appConfig: AppConfig;
  defaultPrograms: Program[];
  workspaceView: WorkspaceView;
  courses: Course[];
  courseTemplates: CourseTemplate[];
  isLoadingCourses: boolean;
  isCourseEditorOpen: boolean;
  isCourseSaving: boolean;
  courseEditorError: string;
  courseImageError: string;
  courseImageFileName: string;
  courseDraft: CourseDraft;
  isCoursePickerOpen: boolean;
  coursePickerLead: Lead | null;
  coursePickerMode: CoursePickerMode;
  textSize: TextSize;
}

export interface SevaWorkspaceContext extends SevaWorkspaceState {
  $nextTick?: (callback: () => void) => void;
  $refs?: {
    followUpInput?: {
      focus: () => void;
    };
  };
  [key: string]: any;
}
