import { ZodError } from 'zod';
import { type ApiErrorContext, type ApiErrorOverride } from '@aolt/core/api-errors';
import { SheetsRequestError } from './operations.js';

export type SheetsAwareApiErrorCodes<TCode extends string> = {
  validation: TCode;
  upstreamTimeout: TCode;
  upstreamError: TCode;
  internal: TCode;
};

export function createSheetsAwareApiErrorClassifier<TCode extends string>(
  codes: SheetsAwareApiErrorCodes<TCode>
) {
  return function classifySheetsAwareApiError(
    error: unknown,
    context: ApiErrorContext,
    override?: ApiErrorOverride<TCode>
  ): ApiErrorOverride<TCode> {
    if (override) {
      return override;
    }

    if (error instanceof SheetsRequestError) {
      if (error.kind === 'timeout') {
        return {
          status: 504,
          code: codes.upstreamTimeout,
          message:
            context.messages?.timeout ||
            'Unable to access data right now. Please try again.',
          retryable: true,
          category: 'upstream_timeout'
        };
      }

      if (error.kind === 'network') {
        return {
          status: 503,
          code: codes.upstreamError,
          message:
            context.messages?.upstream ||
            'Unable to access data right now. Please try again.',
          retryable: true,
          category: 'upstream_network'
        };
      }

      const permissionFailure =
        error.kind === 'permission' || error.kind === 'authentication';
      return {
        status: 502,
        code: codes.upstreamError,
        message: permissionFailure
          ? context.messages?.upstreamPermission ||
            context.messages?.upstream ||
            'Unable to access data right now. Please contact an admin if this continues.'
          : context.messages?.upstream ||
            'Unable to access data right now. Please try again.',
        retryable: permissionFailure ? false : error.retryable,
        category: permissionFailure
          ? 'upstream_authentication_or_permission'
          : 'upstream_failure'
      };
    }

    if (error instanceof ZodError) {
      return {
        status: 400,
        code: codes.validation,
        message: context.messages?.validation || 'Some provided details are invalid.',
        retryable: false,
        category: 'validation'
      };
    }

    return {
      status: 500,
      code: codes.internal,
      message:
        context.messages?.internal ||
        'Unable to complete this action. Please try again.',
      retryable: false,
      category: 'internal'
    };
  };
}
