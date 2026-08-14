import { ErrorHandler, Service, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorReportingService } from '../services/error-reporting/error-reporting';

/**
 * App-wide error handler:
 * logs every uncaught error and forwards a sanitized report to the reporting
 * sink. HttpErrorResponse is skipped — those are handled at the HTTP layer.
 */
@Service()
export class GlobalErrorHandler implements ErrorHandler {
  #errorReporting = inject(ErrorReportingService);
  #document = inject(DOCUMENT);

  handleError(error: unknown): void {
    console.error(error);

    if (error instanceof HttpErrorResponse) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    const source = error instanceof Error ? (error.stack ?? '') : '';
    const url = this.#document.location?.href ?? '';
    this.#errorReporting.reportError(message, source, url);
  }
}
