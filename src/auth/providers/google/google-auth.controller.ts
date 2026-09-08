import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccountResolverService } from '../../account/account-resolver.service';
import { AuthResponseDto } from '../../dto/auth-response.dto';
import { TokenService } from '../../token/token.service';
import { VerifiedIdentity } from '../verified-identity.interface';
import { GoogleAuthGuard } from './google-auth.guard';
import { GOOGLE_PROVIDER } from './google.strategy';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';

@ApiTags('Authentication')
@Controller('auth/google')
export class GoogleAuthController {
  constructor(
    private readonly accountResolver: AccountResolverService,
    private readonly tokenService: TokenService,
  ) {}

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
  @ResponseMessage('Login successful')
  @ApiOperation({
    summary: 'Google sign-in callback',
    description:
      'Resolves the Google identity to an account and returns the same token pair as password login. Answers with JSON rather than a redirect, so tokens never enter a URL, browser history or access log. Signing in with an address that already has a password account links the two, after which that account can no longer sign in with a password — there is no endpoint to set one again.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Signed in',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The email already has an account and Google did not verify the address',
  })
  async callback(@Req() request: Request): Promise<AuthResponseDto> {
    // Passport places whatever the strategy returned onto the request. Nobody is
    // authenticated on this route yet, so what arrives is a provider identity rather than
    // the application user that the request object declares — hence the double cast.
    const identity = request.user as unknown as VerifiedIdentity;

    const account = await this.accountResolver.resolve(identity);
    const tokens = await this.tokenService.issuePair(account.id);

    return new AuthResponseDto({
      email: account.email,
      username: account.username,
      bio: account.bio,
      image: account.image,
      ...tokens,
    });
  }
}
