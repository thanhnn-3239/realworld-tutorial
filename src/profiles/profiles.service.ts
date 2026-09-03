import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ProfilesRepository } from './profiles.repository';
import { ProfileResponse } from './interfaces/profile-response.interface';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly i18n: I18nService,
  ) {}

  async getProfile(
    username: string,
    viewerId?: number,
  ): Promise<ProfileResponse> {
    const profile = await this.profilesRepository.findByUsername(
      username,
      viewerId,
    );
    if (!profile) {
      throw new NotFoundException(this.i18n.t('common.error.profileNotFound'));
    }
    return this.toResponse(profile);
  }

  async followUser(
    viewerId: number,
    username: string,
  ): Promise<ProfileResponse> {
    const target = await this.requireProfile(username);

    if (target.id === viewerId) {
      throw new UnprocessableEntityException(
        this.i18n.t('common.error.followSelf'),
      );
    }

    const alreadyFollowing = await this.profilesRepository.isFollowing(
      viewerId,
      target.id,
    );
    if (alreadyFollowing) {
      return this.toResponse(target, true);
    }

    await this.profilesRepository.follow(viewerId, target.id);
    return this.toResponse(target, true);
  }

  async unfollowUser(
    viewerId: number,
    username: string,
  ): Promise<ProfileResponse> {
    const target = await this.requireProfile(username);

    const isFollowing = await this.profilesRepository.isFollowing(
      viewerId,
      target.id,
    );
    if (!isFollowing) {
      return this.toResponse(target, false);
    }

    await this.profilesRepository.unfollow(viewerId, target.id);
    return this.toResponse(target, false);
  }

  private async requireProfile(username: string) {
    const profile = await this.profilesRepository.findByUsername(username);
    if (!profile) {
      throw new NotFoundException(this.i18n.t('common.error.profileNotFound'));
    }
    return profile;
  }

  private toResponse(
    profile: NonNullable<
      Awaited<ReturnType<ProfilesRepository['findByUsername']>>
    >,
    following = profile.followedBy.length > 0,
  ): ProfileResponse {
    return {
      username: profile.username,
      bio: profile.bio,
      image: profile.image,
      following,
    };
  }
}
