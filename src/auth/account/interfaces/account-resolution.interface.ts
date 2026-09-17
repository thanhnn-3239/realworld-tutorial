import { AccountRow } from '../account-user.repository';

export type AccountResolution =
  | { kind: 'account'; account: AccountRow }
  | { kind: 'confirmation-required' };
