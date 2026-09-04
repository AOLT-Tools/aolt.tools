import type { ApiErrorCode } from '../shared/contracts/appContracts.js';
import { SheetsRequestError } from './sheets/client.js';
import {
  createApiErrorReporter,
  type ApiErrorContext as FrameworkApiErrorContext,
  type ApiErrorMessages as FrameworkApiErrorMessages,
  type ApiErrorOverride as FrameworkApiErrorOverride,
  type ReportedApiError as FrameworkReportedApiError
} from '@aolt/core/api-errors';
import type { ApiResponse } from '@aolt/core/api';
import { createSheetsAwareApiErrorClassifier } from '@aolt/integrations/sheets/api-errors';

export type ApiErrorMessages = FrameworkApiErrorMessages;
export type ApiErrorContext = FrameworkApiErrorContext;
export type ApiErrorOverride = FrameworkApiErrorOverride<ApiErrorCode>;
export type ReportedApiError = FrameworkReportedApiError<ApiErrorCode>;

const classifyApiError = createSheetsAwareApiErrorClassifier<ApiErrorCode>({
  validation: 'VALIDATION_ERROR',
  upstreamTimeout: 'UPSTREAM_TIMEOUT',
  upstreamError: 'UPSTREAM_ERROR',
  internal: 'INTERNAL_ERROR'
});

const apiErrorReporter = createApiErrorReporter<ApiErrorCode>({
  classify: classifyApiError,
  logDetails(error) {
    return error instanceof SheetsRequestError
      ? {
          upstream: 'google_sheets',
          target: error.target,
          sheetsAction: error.action,
          upstreamStatus: error.upstreamStatus,
          timeoutStage: error.timeoutStage,
          upstreamError: error.safeUpstreamError,
          sheetsDurationMs: error.durationMs
        }
      : {};
  }
});

export const reportApiError = apiErrorReporter.reportApiError;
export const sendApiError = apiErrorReporter.sendApiError;

export function methodNotAllowed(
  res: ApiResponse,
  context: ApiErrorContext,
  allow: string
) {
  res.setHeader('Allow', allow);
  return sendApiError(res, new Error('Method not allowed.'), context, {
    status: 405,
    code: 'METHOD_NOT_ALLOWED',
    message: 'Method not allowed.',
    retryable: false,
    category: 'method_not_allowed'
  });
}
