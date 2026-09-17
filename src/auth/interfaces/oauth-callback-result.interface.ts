import { AuthResponseDto } from '../dto/auth-response.dto';
import { ProviderLinkPendingResponseDto } from '../dto/provider-link-pending-response.dto';

export type OAuthCallbackResult =
  | { kind: 'authenticated'; data: AuthResponseDto }
  | {
      kind: 'confirmation-required';
      data: ProviderLinkPendingResponseDto;
    };
