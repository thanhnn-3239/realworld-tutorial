import type { ImageProcessingProfile } from './image-processing-profile.interface';

export interface ImageProcessingTask {
  image: Uint8Array;
  profile: ImageProcessingProfile;
}
