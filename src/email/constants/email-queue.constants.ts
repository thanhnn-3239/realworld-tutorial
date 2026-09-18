export const EMAIL_QUEUE_NAME = 'email';

export const AUTH_PROVIDER_LINK_CONFIRMATION_JOB =
  'auth-provider-link-confirmation';

export const EMAIL_JOB_ID_PREFIX = 'google-link-';

export const ARTICLE_NOTIFICATION_JOB = 'article-notification';

export const ARTICLE_NOTIFICATION_JOB_ID_PREFIX = 'article-notification-';

export const EMAIL_QUEUE_ATTEMPTS = 3;

export const EMAIL_QUEUE_BACKOFF_DELAY_MS = 5_000;

export const EMAIL_QUEUE_BACKOFF_TYPE = 'exponential';

export const EMAIL_QUEUE_FAILED_JOB_AGE_SECS = 86_400;

export const EMAIL_QUEUE_FAILED_JOB_MAX_COUNT = 1_000;

export const EMAIL_PRODUCER_CONFIG_KEY = 'email-producer';

export const EMAIL_WORKER_CONFIG_KEY = 'email-worker';
