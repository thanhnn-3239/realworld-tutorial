import { IMAGE_PROCESSING_PROFILES } from './image-processing-profiles.constants';

describe('IMAGE_PROCESSING_PROFILES', () => {
  it('freezes the avatar input and output policy', () => {
    expect(IMAGE_PROCESSING_PROFILES.avatar).toEqual({
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
    });
  });
});
