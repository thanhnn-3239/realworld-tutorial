import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from '../../auth.service';
import { AuthResponseDto } from '../../dto/auth-response.dto';
import { ProviderLinkPendingResponseDto } from '../../dto/provider-link-pending-response.dto';
import { VerifiedIdentity } from '../verified-identity.interface';
import { GoogleAuthGuard } from './google-auth.guard';
import { GOOGLE_PROVIDER } from './google.strategy';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';

@ApiTags('Authentication')
@Controller('auth/google')
export class GoogleAuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Intentionally empty: `AuthGuard` issues the redirect before the handler body would run.
   */
  @Get()
  @UseGuards(AuthGuard(GOOGLE_PROVIDER))
  @ApiOperation({
    summary: 'Start the Google sign-in flow',
    description:
      'Redirects to the Google consent screen. Returns 404 when Google is not configured. ' +
      'DO NOT use "Execute" below: this route must be navigated to, not fetched. Swagger ' +
      'calls it with fetch(), the browser follows the 302 to accounts.google.com, and Google ' +
      'sends no CORS header for this origin — so the call always fails with "Failed to ' +
      'fetch" even though the redirect is correct. Every OAuth provider behaves this way on ' +
      'purpose: the consent screen has to be seen by a real user in a real navigation. ' +
      'Paste http://localhost:3000/v1/auth/google into the browser address bar instead.',
  })
  @ApiResponse({ status: HttpStatus.FOUND, description: 'Redirect to Google' })
  start(): void {}

  @Get('callback')
  @UseGuards(GoogleAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Google sign-in processed')
  @ApiOperation({
    summary: 'Google sign-in callback',
    description:
      'Resolves the Google identity to an account. Returns tokens for an existing provider link or a new account. When the email belongs to a local account, sends a confirmation email and returns 202 without tokens.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Signed in',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Email confirmation is required before linking',
    type: ProviderLinkPendingResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The email already has an account and Google did not verify the address',
  })
  async callback(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto | ProviderLinkPendingResponseDto> {
    const identity = request.user as unknown as VerifiedIdentity;
    const result = await this.authService.handleOAuthCallback(identity);

    if (result.kind === 'confirmation-required') {
      response.status(HttpStatus.ACCEPTED);
    }

    return result.data;
  }
}
