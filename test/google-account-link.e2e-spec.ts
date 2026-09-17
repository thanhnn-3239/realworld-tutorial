import { GoogleAuthGuard } from '../src/auth/providers/google/google-auth.guard';
import { EmailQueueProducer } from '../src/email/email-queue.producer';
import { readE2eBaseConfig } from './support/e2e-config';
import { useE2eSuite } from './support/e2e-suite';
import {
  registerEnqueueFailureScenario,
  registerGoogleAccountLinkEdgeScenarios,
} from './support/google-account-link-edge-scenarios';
import { registerGoogleAccountLinkFlowScenarios } from './support/google-account-link-flow-scenarios';
import { GoogleAuthGuardStub } from './support/google-auth-guard.stub';
import { MailpitClient } from './support/mailpit-client';

const googleGuardOverride = {
  token: GoogleAuthGuard,
  value: new GoogleAuthGuardStub(),
};

describe('Google account link flow (e2e)', () => {
  const e2e = useE2eSuite('google-account-link', {
    guardOverrides: [googleGuardOverride],
  });
  const config = readE2eBaseConfig();
  const mailpit = new MailpitClient(config.mailpitApiUrl);

  registerGoogleAccountLinkFlowScenarios(e2e, mailpit, config.mailpitApiUrl);
  registerGoogleAccountLinkEdgeScenarios(e2e, mailpit);
});

describe('Google account link queue failure (e2e)', () => {
  const e2e = useE2eSuite('google-account-link-queue-failure', {
    guardOverrides: [googleGuardOverride],
    providerOverrides: [
      {
        token: EmailQueueProducer,
        value: {
          enqueueProviderLinkConfirmation: jest
            .fn()
            .mockRejectedValue(new Error('queue unavailable')),
        },
      },
    ],
  });

  registerEnqueueFailureScenario(e2e);
});
