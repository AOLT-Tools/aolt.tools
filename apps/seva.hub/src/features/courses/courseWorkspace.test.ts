import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_IMAGE_BYTES } from '../../../shared/contracts/activityImage';
import { ApiClientError } from '../../services/apiClient';
import { sevaWorkspace } from '../seva/sevaWorkspace';

describe('course editor validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows an oversized image error inside the course editor', async () => {
    const app = sevaWorkspace();
    await app.openCourseEditor();
    const input = {
      files: [{ size: MAX_IMAGE_BYTES, type: 'image/png' }],
      value: 'image.png'
    };

    await app.onImageSelected({ target: input } as unknown as Event);

    expect(app.courseImageError).toBe('Image must be < 3 MB');
    expect(app.courseImageFileName).toBe('');
    expect(app.courseEditorError).toBe('');
    expect(app.authError).toBe('');
    expect(app.isCourseEditorOpen).toBe(true);
    expect(input.value).toBe('');
  });

  it('keeps a server save error visible in the open course editor', async () => {
    const createCourse = vi.fn(async () => {
      throw new ApiClientError('Invalid course details.', 400, 'VALIDATION_ERROR');
    });
    vi.stubGlobal('window', { appRuntime: { createCourse } });
    const app = sevaWorkspace();
    await app.openCourseEditor();

    await app.saveCourse();

    expect(app.courseEditorError).toBe('Invalid course details.');
    expect(app.authError).toBe('');
    expect(app.isCourseEditorOpen).toBe(true);
    expect(app.isCourseSaving).toBe(false);
  });
});
