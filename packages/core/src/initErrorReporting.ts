import {
  addBreadcrumb,
  captureException,
  captureMessage,
  init as sentryInit,
} from "@sentry/node";
import { ConsoleHandler, Level, configure } from "nightingale";
import { SentryHandler } from "nightingale-sentry";

export interface InitErrorReportingOptions {
  service: string;
  /**
   * false when something else already reports to Sentry from SENTRY_DSN: a
   * second SDK in the process would instrument it twice and report errors twice
   */
  reportToSentry?: boolean;
}

/**
 * Call first in a server entry point, before any logger is used. Logs go to the
 * console; errors also go to Sentry when SENTRY_DSN is set, nothing is reported
 * otherwise.
 */
export const initErrorReporting = ({
  service,
  reportToSentry = true,
}: InitErrorReportingOptions): void => {
  const dsn = (reportToSentry && process.env.SENTRY_DSN) || undefined;
  const configs: Parameters<typeof configure>[0] = [
    { handlers: [new ConsoleHandler(Level.INFO)] },
  ];

  if (dsn) {
    sentryInit({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || undefined,
      initialScope: { tags: { service } },
    });
    configs.push({
      handlers: [
        new SentryHandler(
          { addBreadcrumb, captureException, captureMessage },
          Level.ERROR,
        ),
      ],
    });
  }

  configure(configs);
};
