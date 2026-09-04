import type { SevaWorkspaceContext, CourseDraft, Lead } from '../seva/types';
import type { Course } from '../../../shared/contracts/appContracts';
import { toUserErrorMessage } from '../../services/apiClient';
import { createEmptyCourseDraft } from '../seva/state';
import { findUniqueActiveCourse } from '../../../shared/contracts/courseMatching';
import {
  formatActivityTitle,
  isIpCourseType,
  normalizeActivityType,
  normalizeProgramCode,
  publicCourseProgramKey,
  publicCoursesPath
} from '../../../shared/contracts/courseDefaults.mjs';
import {
  templateForActivity,
  templateForCourseType
} from '../../../shared/contracts/courseTemplates.mjs';
import {
  inspectImageUpload,
  MAX_IMAGE_BYTES,
  IMAGE_SIZE_ERROR
} from '../../../shared/contracts/activityImage';
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
  showsProgramTabs,
  templateFromList
} from './courseWorkspaceCore';

type ShareNavigator = Navigator & {
  canShare?: (data: ShareData) => boolean;
};

type ClipboardItemConstructor = {
  new (items: Record<string, Blob>): ClipboardItem;
  supports?: (mimeType: string) => boolean;
};

async function convertImageBlobToPng(blob: Blob): Promise<Blob | null> {
  if (blob.type === 'image/png') {
    return blob;
  }
  if (typeof createImageBitmap !== 'function') {
    return null;
  }

  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    context.drawImage(bitmap, 0, 0);
    return await new Promise((resolve) => {
      canvas.toBlob((png) => resolve(png), 'image/png');
    });
  } finally {
    bitmap.close();
  }
}

function courseToDraft(course: Course): CourseDraft {
  return {
    id: course.id,
    activityType: normalizeActivityType(course.activityType),
    courseType: course.courseType || '',
    programCode: course.programCode || '',
    title: course.title || '',
    whatsappTemplate: course.whatsappTemplate || '',
    isActive: course.isActive,
    hasImage: Boolean(course.hasImage),
    clearImage: false,
    imageBase64: '',
    imageMimeType: '',
    imagePreviewUrl: courseImageUrlForCourse(course)
  };
}

export function createCourseWorkspaceMethods() {
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
    courseImageUrl(this: SevaWorkspaceContext, course: Course): string {
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
    courseCardSubtitle(this: SevaWorkspaceContext, course: Course): string {
      return courseCardSubtitle(course);
    },
    canOpenPublicCoursePage(this: SevaWorkspaceContext, course: Course): boolean {
      return canOpenPublicCoursePage(course);
    },
    templateForType(
      this: SevaWorkspaceContext,
      courseType: string,
      programCode = ''
    ): string {
      return templateFromList(
        courseType,
        programCode,
        this.courseTemplates,
        templateForCourseType
      );
    },
    onActivityTypeChange(this: SevaWorkspaceContext): void {
      const nextType = this.courseDraft.activityType;
      if (nextType === 'Event') {
        this.courseDraft.courseType = '';
        this.courseDraft.programCode = '';
        if (!this.courseDraft.id || !this.courseDraft.whatsappTemplate.trim()) {
          this.courseDraft.whatsappTemplate = templateForActivity('Event', '');
        }
        return;
      }

      const programs =
        this.appConfig.programs.length > 0
          ? this.appConfig.programs
          : this.defaultPrograms;
      this.courseDraft.courseType =
        this.courseDraft.courseType || programs[0]?.code || 'HP';
      this.courseDraft.title = '';
      this.onCourseTypeChange();
    },
    selectCourseActivityType(
      this: SevaWorkspaceContext,
      activityType: 'Course' | 'Event'
    ): void {
      this.courseDraft.activityType = activityType;
      this.onActivityTypeChange();
    },
    onCourseTypeChange(this: SevaWorkspaceContext): void {
      if (this.courseDraft.id || this.courseDraft.activityType === 'Event') {
        return;
      }
      if (isIpCourseType(this.courseDraft.courseType)) {
        this.courseDraft.programCode = this.courseDraft.programCode || 'j';
      } else {
        this.courseDraft.programCode = '';
      }
      this.courseDraft.whatsappTemplate = this.templateForType(
        this.courseDraft.courseType,
        this.courseDraft.programCode
      );
    },
    onProgramCodeChange(this: SevaWorkspaceContext): void {
      if (this.courseDraft.id || this.courseDraft.activityType === 'Event') {
        return;
      }
      this.courseDraft.whatsappTemplate = this.templateForType(
        this.courseDraft.courseType,
        this.courseDraft.programCode
      );
    },
    selectCourseProgram(this: SevaWorkspaceContext, programCode: string): void {
      this.courseDraft.programCode = programCode;
      this.onProgramCodeChange();
    },
    onImageSelected(this: SevaWorkspaceContext, event: Event): void {
      const input = event.target as HTMLInputElement | null;
      const file = input?.files?.[0];
      if (!file) {
        return;
      }
      this.courseEditorError = '';
      if (file.size >= MAX_IMAGE_BYTES) {
        this.courseImageError = IMAGE_SIZE_ERROR;
        this.courseImageFileName = '';
        input.value = '';
        return;
      }
      this.courseImageError = '';
      this.courseImageFileName = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const comma = dataUrl.indexOf(',');
        this.courseDraft.imagePreviewUrl = dataUrl;
        this.courseDraft.imageBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
        this.courseDraft.imageMimeType = file.type;
        this.courseDraft.hasImage = true;
        this.courseDraft.clearImage = false;
      };
      reader.onerror = () => {
        this.courseImageError = 'Unable to read that image. Please choose it again.';
        this.courseImageFileName = '';
        input.value = '';
      };
      reader.readAsDataURL(file);
    },
    clearCourseImage(this: SevaWorkspaceContext): void {
      this.courseEditorError = '';
      this.courseImageError = '';
      this.courseImageFileName = '';
      this.courseDraft.hasImage = false;
      this.courseDraft.clearImage = true;
      this.courseDraft.imageBase64 = '';
      this.courseDraft.imageMimeType = '';
      this.courseDraft.imagePreviewUrl = '';
    },
    async switchWorkspaceView(
      this: SevaWorkspaceContext,
      view: 'callTracker' | 'courseManagement'
    ): Promise<void> {
      this.workspaceView = view;
      this.isFabOpen = false;
      if (view === 'courseManagement') {
        await this.loadCourses();
      }
    },
    async loadCourses(this: SevaWorkspaceContext, force = false): Promise<void> {
      if (this.isLoadingCourses) {
        return;
      }
      if (this.courses.length && !force) {
        return;
      }
      this.isLoadingCourses = true;
      try {
        const response = await window.appRuntime.listCourses();
        this.courses = response.courses;
        this.courseTemplates = response.templates || [];
      } catch (error) {
        this.authError = toUserErrorMessage(
          error,
          'Unable to load activities right now.'
        );
      } finally {
        this.isLoadingCourses = false;
      }
    },
    openCourseEditor(this: SevaWorkspaceContext, course?: Course): void {
      this.courseEditorError = '';
      this.courseImageError = '';
      this.courseImageFileName = '';
      if (course) {
        this.courseDraft = courseToDraft(course);
      } else {
        const programs =
          this.appConfig.programs.length > 0
            ? this.appConfig.programs
            : this.defaultPrograms;
        const courseType = programs[0]?.code || 'HP';
        const programCode = isIpCourseType(courseType) ? 'j' : '';
        const activityType = this.campaignType === 'Members' ? 'Event' : 'Course';
        this.courseDraft = {
          ...createEmptyCourseDraft(courseType),
          activityType,
          programCode,
          courseType: activityType === 'Event' ? '' : courseType,
          title: '',
          whatsappTemplate:
            activityType === 'Event'
              ? templateForActivity('Event', '')
              : this.templateForType(courseType, programCode)
        };
      }
      this.isCourseEditorOpen = true;
    },
    closeCourseEditor(this: SevaWorkspaceContext): void {
      this.isCourseEditorOpen = false;
      this.isCourseSaving = false;
      this.courseEditorError = '';
      this.courseImageError = '';
      this.courseImageFileName = '';
      this.courseDraft = createEmptyCourseDraft();
    },
    openPublicCoursePage(this: SevaWorkspaceContext, course: Course): void {
      window.location.href = publicCoursesPath(
        publicCourseProgramKey(course.courseType, course.programCode)
      );
    },
    async fetchCourseImageFile(
      this: SevaWorkspaceContext,
      course: Course
    ): Promise<{ blob: Blob; file: File } | null> {
      const url = this.courseImageUrl(course);
      if (!url) {
        return null;
      }
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const blob = await response.blob();
      const mimeType = blob.type || 'image/jpeg';
      const file = new File([blob], this.courseImageDownloadName(course), {
        type: mimeType
      });
      return { blob, file };
    },
    async copyCourseImageToClipboard(
      this: SevaWorkspaceContext,
      course: Course
    ): Promise<boolean> {
      const clipboard = navigator.clipboard;
      const ClipboardItemCtor = window.ClipboardItem as
        ClipboardItemConstructor | undefined;
      if (!clipboard?.write || !ClipboardItemCtor || !course.hasImage) {
        return false;
      }

      try {
        const image = await this.fetchCourseImageFile(course);
        if (!image) {
          return false;
        }
        const sourceMimeType = String(image.blob.type || '').trim();
        if (sourceMimeType && ClipboardItemCtor.supports?.(sourceMimeType)) {
          await clipboard.write([
            new ClipboardItemCtor({
              [sourceMimeType]: image.blob
            })
          ]);
          return true;
        }
        const png = await convertImageBlobToPng(image.blob);
        if (!png) {
          return false;
        }
        await clipboard.write([
          new ClipboardItemCtor({
            'image/png': png
          })
        ]);
        return true;
      } catch {
        return false;
      }
    },
    async shareCourseImage(
      this: SevaWorkspaceContext,
      course: Course
    ): Promise<boolean> {
      this.authError = '';
      if (!course.hasImage) {
        this.actionMessage = 'No image is attached to this activity.';
        return false;
      }

      try {
        const image = await this.fetchCourseImageFile(course);
        const shareNavigator = navigator as ShareNavigator;
        if (!image || !shareNavigator.share) {
          this.actionMessage = 'Image sharing is not supported in this browser.';
          return false;
        }
        const shareData: ShareData = {
          files: [image.file],
          title: this.courseDisplayTitle(course)
        };
        if (shareNavigator.canShare && !shareNavigator.canShare(shareData)) {
          this.actionMessage = 'Image sharing is not supported in this browser.';
          return false;
        }
        await shareNavigator.share(shareData);
        return true;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return false;
        }
        this.actionMessage = 'Unable to share the image from this browser.';
        return false;
      }
    },
    downloadCourseImage(this: SevaWorkspaceContext, course: Course): void {
      const url = this.courseImageUrl(course);
      if (!url) {
        this.actionMessage = 'No image is attached to this activity.';
        return;
      }
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = this.courseImageDownloadName(course);
      anchor.rel = 'noopener';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      this.actionMessage = 'Image download started.';
    },
    async saveCourse(this: SevaWorkspaceContext): Promise<void> {
      if (this.isCourseSaving) {
        return;
      }
      if (this.courseDraft.imageBase64.trim()) {
        const inspected = inspectImageUpload(
          this.courseDraft.imageBase64,
          this.courseDraft.imageMimeType
        );
        if (!inspected.ok) {
          this.courseEditorError = '';
          this.courseImageError = inspected.message;
          return;
        }
      }
      this.isCourseSaving = true;
      this.authError = '';
      this.courseEditorError = '';
      this.courseImageError = '';
      try {
        const payload = {
          activityType: this.courseDraft.activityType,
          courseType: this.courseDraft.courseType,
          programCode: normalizeProgramCode(
            this.courseDraft.courseType,
            this.courseDraft.programCode
          ),
          title: this.courseDraft.title,
          whatsappTemplate: this.courseDraft.whatsappTemplate,
          isActive: this.courseDraft.isActive,
          imageBase64: this.courseDraft.imageBase64,
          imageMimeType: this.courseDraft.imageMimeType,
          clearImage: this.courseDraft.clearImage
        };
        if (this.courseDraft.id) {
          const response = await window.appRuntime.updateCourse({
            ...payload,
            id: this.courseDraft.id
          });
          this.courses = this.courses.map((course) =>
            course.id === response.course.id ? response.course : course
          );
        } else {
          const response = await window.appRuntime.createCourse(payload);
          this.courses = [...this.courses, response.course];
        }
        this.actionMessage = 'Activity saved.';
        this.closeCourseEditor();
      } catch (error) {
        const message = toUserErrorMessage(error, 'Unable to save the activity.');
        if (message === IMAGE_SIZE_ERROR) {
          this.courseImageError = message;
        } else {
          this.courseEditorError = message;
        }
      } finally {
        this.isCourseSaving = false;
      }
    },
    async toggleCourseActive(
      this: SevaWorkspaceContext,
      course: Course
    ): Promise<void> {
      try {
        const response = await window.appRuntime.updateCourse({
          id: course.id,
          activityType: course.activityType,
          courseType: course.courseType,
          programCode: course.programCode || '',
          title: course.title || '',
          whatsappTemplate: course.whatsappTemplate,
          isActive: !course.isActive,
          imageBase64: '',
          imageMimeType: ''
        });
        this.courses = this.courses.map((item) =>
          item.id === response.course.id ? response.course : item
        );
      } catch (error) {
        this.authError = toUserErrorMessage(error, 'Unable to update the activity.');
      }
    },
    async deleteCourse(this: SevaWorkspaceContext, course: Course): Promise<void> {
      if (
        !window.confirm(
          'Delete ' + formatActivityTitle(course) + '? This cannot be undone.'
        )
      ) {
        return;
      }
      try {
        await window.appRuntime.deleteCourse({ id: course.id });
        this.courses = this.courses.filter((item) => item.id !== course.id);
        this.actionMessage = 'Activity deleted.';
      } catch (error) {
        this.authError = toUserErrorMessage(error, 'Unable to delete the activity.');
      }
    },
    closeCoursePicker(this: SevaWorkspaceContext): void {
      this.isCoursePickerOpen = false;
      this.coursePickerLead = null;
      this.coursePickerMode = 'whatsapp';
    },
    async openWhatsappWithCourse(
      this: SevaWorkspaceContext,
      lead: Lead,
      course: Course | null
    ): Promise<void> {
      if (course?.hasImage) {
        await this.copyCourseImageToClipboard(course);
      }
      window.open(this.buildWhatsappHref(lead, course), '_blank', 'noopener');
    },
    async openWhatsappForLead(this: SevaWorkspaceContext, lead: Lead): Promise<void> {
      if (!this.canOpenWhatsapp(lead)) {
        this.authError = 'Add a mobile number before opening WhatsApp.';
        return;
      }
      await this.loadCourses();
      const active = this.activeCourses(lead);
      if (!active.length) {
        window.open(this.buildWhatsappHref(lead), '_blank', 'noopener');
        return;
      }
      const matching = matchingCoursesForLead(lead, active);
      if (!matching.length) {
        window.open(this.buildWhatsappHref(lead), '_blank', 'noopener');
        this.actionMessage =
          'No matching activity found. WhatsApp opened with an empty message.';
        return;
      }
      const unique =
        matching.length === 1
          ? matching[0]
          : findUniqueActiveCourse(lead.wishlistPrograms, matching);
      if (unique) {
        await this.openWhatsappWithCourse(lead, unique);
        return;
      }
      this.coursePickerLead = lead;
      this.coursePickerMode = 'whatsapp';
      this.isCoursePickerOpen = true;
    },
    async openImageShareForLead(this: SevaWorkspaceContext, lead: Lead): Promise<void> {
      await this.loadCourses();
      const activeWithImages = this.activeCourses(lead).filter(
        (course: Course) => course.hasImage
      );
      if (!activeWithImages.length) {
        this.actionMessage = 'No activity image is available to share.';
        return;
      }

      const matching = matchingCoursesForLead(lead, activeWithImages);
      if (!matching.length) {
        this.actionMessage = 'No matching activity image is available to share.';
        return;
      }
      const unique =
        matching.length === 1
          ? matching[0]
          : findUniqueActiveCourse(lead.wishlistPrograms, matching);
      if (unique) {
        await this.shareCourseImage(unique);
        return;
      }

      this.coursePickerLead = lead;
      this.coursePickerMode = 'imageShare';
      this.isCoursePickerOpen = true;
    },
    async selectCourseFromPicker(
      this: SevaWorkspaceContext,
      course: Course
    ): Promise<void> {
      const lead = this.coursePickerLead;
      const mode = this.coursePickerMode;
      this.closeCoursePicker();
      if (!lead || !course.isActive) {
        return;
      }
      if (mode === 'imageShare') {
        await this.shareCourseImage(course);
        return;
      }
      await this.openWhatsappWithCourse(lead, course);
    }
  };
}
