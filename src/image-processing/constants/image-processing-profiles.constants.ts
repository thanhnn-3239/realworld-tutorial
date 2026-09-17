import type { ImageProcessingProfile } from '../interfaces/image-processing-profile.interface';

export const IMAGE_PROCESSING_PROFILES = {
  avatar: {
    acceptedFormats: ['jpeg', 'png', 'webp'],
    minShortestSide: 256,
    limitInputPixels: 16_000_000,
    width: 512,
    height: 512,
    fit: 'cover',
    position: 'centre',
    outputFormat: 'webp',
    quality: 82,
    animated: false,
    maxPages: 1,
  } as const satisfies ImageProcessingProfile,
} as const;
