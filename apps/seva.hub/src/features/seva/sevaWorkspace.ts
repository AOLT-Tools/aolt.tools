import { createSevaWorkspaceInitialState } from './state';
import { createAuthAndBootstrapMethods } from './authAndBootstrap';
import { createLeadLifecycleMethods } from './leadLifecycle';
import { createProgramMethods } from './programs';
import { createDateAndFilterMethods } from './dateAndFilter';
import { createUiMethods } from './uiMethods';
import { createCommunicationMethods } from './communications';
import { createRecordActionMethods } from './recordActions';
import type { SevaWorkspaceContext, Lead } from './types';
import type { Course } from '../../../shared/contracts/appContracts';
import {
  activeCoursesForContext,
  canOpenPublicCoursePage,
  courseCardSubtitle,
  courseDisplayTitle,
  courseImageDownloadName,
  courseImageUrl as courseImageUrlForCourse,
  coursePickerOptionsForContext,
  coursePickerSubtitle,
  coursePickerTitle,
  ipPrograms,
  isCourseDraftEvent,
  matchingCoursesForLead,
  showsProgramTabs
} from '../courses/courseWorkspaceCore';

type CourseWorkspaceMethods = ReturnType<
  (typeof import('../courses/courseWorkspace'))['createCourseWorkspaceMethods']
>;

let courseWorkspaceMethodsPromise: Promise<CourseWorkspaceMethods> | null = null;

async function loadCourseWorkspaceMethods(): Promise<CourseWorkspaceMethods> {
  if (!courseWorkspaceMethodsPromise) {
    courseWorkspaceMethodsPromise = import('../courses/courseWorkspace').then(
      ({ createCourseWorkspaceMethods }) => createCourseWorkspaceMethods()
    );
  }
  return courseWorkspaceMethodsPromise;
}

async function installCourseWorkspaceMethods(
  context: SevaWorkspaceContext
): Promise<CourseWorkspaceMethods> {
  const methods = await loadCourseWorkspaceMethods();
  Object.assign(context, methods);
  return methods;
}

function lazyCourseMethod(name: keyof CourseWorkspaceMethods) {
  return async function (
    this: SevaWorkspaceContext,
    ...args: unknown[]
  ): Promise<unknown> {
    const methods = await installCourseWorkspaceMethods(this);
    return (methods[name] as (...methodArgs: unknown[]) => unknown).apply(this, args);
  };
}

function createLazyCourseWorkspaceMethods() {
  return {
    activeCourses(this: SevaWorkspaceContext, lead?: Lead | null): Course[] {
      return activeCoursesForContext(this, lead);
    },
    pickerCourses(this: SevaWorkspaceContext, lead?: Lead | null): Course[] {
      const active = this.activeCourses(lead);
      const matching = matchingCoursesForLead(lead, active);
      return matching.length ? matching : active;
    },
    coursePickerOptions(this: SevaWorkspaceContext): Course[] {
      return coursePickerOptionsForContext(this);
    },
    coursePickerTitle(this: SevaWorkspaceContext): string {
      return coursePickerTitle(this.coursePickerMode);
    },
    courseImageUrl(course: Course): string {
      return courseImageUrlForCourse(course);
    },
    courseImageDownloadName(this: SevaWorkspaceContext, course: Course): string {
      return courseImageDownloadName(
        this.courseDisplayTitle(course),
        course.imageUrl || ''
      );
    },
    ipPrograms() {
      return ipPrograms();
    },
    isCourseDraftEvent(this: SevaWorkspaceContext): boolean {
      return isCourseDraftEvent(this);
    },
    showsProgramTabs(this: SevaWorkspaceContext): boolean {
      return showsProgramTabs(this);
    },
    courseDisplayTitle(this: SevaWorkspaceContext, course: Course): string {
      return courseDisplayTitle(this, course);
    },
    coursePickerSubtitle(this: SevaWorkspaceContext, course: Course): string {
      return coursePickerSubtitle(this, course);
    },
    courseCardSubtitle(course: Course): string {
      return courseCardSubtitle(course);
    },
    canOpenPublicCoursePage(course: Course): boolean {
      return canOpenPublicCoursePage(course);
    },
    templateForType: lazyCourseMethod('templateForType'),
    onActivityTypeChange: lazyCourseMethod('onActivityTypeChange'),
    selectCourseActivityType: lazyCourseMethod('selectCourseActivityType'),
    onCourseTypeChange: lazyCourseMethod('onCourseTypeChange'),
    onProgramCodeChange: lazyCourseMethod('onProgramCodeChange'),
    selectCourseProgram: lazyCourseMethod('selectCourseProgram'),
    onImageSelected: lazyCourseMethod('onImageSelected'),
    clearCourseImage: lazyCourseMethod('clearCourseImage'),
    switchWorkspaceView: lazyCourseMethod('switchWorkspaceView'),
    loadCourses: lazyCourseMethod('loadCourses'),
    openCourseEditor: lazyCourseMethod('openCourseEditor'),
    closeCourseEditor: lazyCourseMethod('closeCourseEditor'),
    openPublicCoursePage: lazyCourseMethod('openPublicCoursePage'),
    fetchCourseImageFile: lazyCourseMethod('fetchCourseImageFile'),
    copyCourseImageToClipboard: lazyCourseMethod('copyCourseImageToClipboard'),
    shareCourseImage: lazyCourseMethod('shareCourseImage'),
    downloadCourseImage: lazyCourseMethod('downloadCourseImage'),
    saveCourse: lazyCourseMethod('saveCourse'),
    toggleCourseActive: lazyCourseMethod('toggleCourseActive'),
    deleteCourse: lazyCourseMethod('deleteCourse'),
    closeCoursePicker: lazyCourseMethod('closeCoursePicker'),
    openWhatsappWithCourse: lazyCourseMethod('openWhatsappWithCourse'),
    openWhatsappForLead: lazyCourseMethod('openWhatsappForLead'),
    openImageShareForLead: lazyCourseMethod('openImageShareForLead'),
    selectCourseFromPicker: lazyCourseMethod('selectCourseFromPicker')
  };
}

export function sevaWorkspace(): SevaWorkspaceContext {
  return {
    ...createSevaWorkspaceInitialState(),
    ...createAuthAndBootstrapMethods(),
    ...createLeadLifecycleMethods(),
    ...createProgramMethods(),
    ...createDateAndFilterMethods(),
    ...createUiMethods(),
    ...createRecordActionMethods(),
    ...createCommunicationMethods(),
    ...createLazyCourseWorkspaceMethods()
  };
}
