export interface ImageProcessingProfile {
  acceptedFormats: readonly string[];
  minShortestSide: number;
  limitInputPixels: number;
  width: number;
  height: number;
  fit: 'cover';
  position: 'centre';
  outputFormat: 'webp';
  quality: number;
  animated: false;
  maxPages: 1;
}
