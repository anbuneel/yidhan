import * as Sentry from '@sentry/react';

type ReliabilityLevel = 'info' | 'warning' | 'error';

interface ReliabilityEventOptions {
  category: string;
  message: string;
  data?: Record<string, unknown>;
  level?: ReliabilityLevel;
}

export function addReliabilityBreadcrumb({
  category,
  message,
  data,
  level = 'info',
}: ReliabilityEventOptions): void {
  Sentry.addBreadcrumb({
    category: `reliability.${category}`,
    message,
    level,
    data,
  });
}

export function reportReliabilityIssue(
  options: ReliabilityEventOptions,
  error?: unknown
): void {
  addReliabilityBreadcrumb(options);

  const context = {
    level: options.level ?? 'warning',
    tags: {
      area: 'reliability',
      category: options.category,
    },
    extra: options.data,
  };

  if (error instanceof Error) {
    Sentry.captureException(error, context);
    return;
  }

  Sentry.captureMessage(options.message, context);
}
