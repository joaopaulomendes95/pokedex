import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { ErrorReportingService } from '@core/services/error-reporting/error-reporting';

/**
 * Central HTTP error handling: failed requests are recorded in the error
 * sink so the app can surface them (per-view loading/error states are driven
 * by the resource signals themselves, so nothing is toasted here).
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorReporting = inject(ErrorReportingService);
  return next(req).pipe(
    tap({
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          errorReporting.reportError(
            `HTTP ${error.status} ${req.method} ${req.url}`,
            error.message,
            '',
          );
        } else {
          errorReporting.reportError('HTTP request failed', String(error), '');
        }
      },
    }),
  );
};
