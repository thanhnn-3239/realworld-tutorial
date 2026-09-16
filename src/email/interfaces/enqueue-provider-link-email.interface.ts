import { ProviderLinkConfirmationJob } from './provider-link-confirmation-job.interface';

export interface EnqueueProviderLinkEmail {
  job: ProviderLinkConfirmationJob;
  tokenHashPrefix: string;
}
