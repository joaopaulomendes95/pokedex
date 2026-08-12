import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorReportingService } from '../services/error-reporting/error-reporting.service';

/**
 * App-wide error handler:
 * logs every uncaught error and forwards a sanitized report to the reporting
 * sink. HttpErrorResponse is skipped — those are handled at the HTTP layer.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorReporting = inject(ErrorReportingService);

  handleError(error: unknown): void {
    console.error(error);

    if (error instanceof HttpErrorResponse) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    const source = error instanceof Error ? (error.stack ?? '') : '';
    this.errorReporting.reportError(message, source, window.location.href);
  }
}
