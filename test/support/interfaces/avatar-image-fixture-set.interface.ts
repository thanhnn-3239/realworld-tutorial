export interface AvatarImageFixtureSet {
  readonly jpeg: Buffer;
  readonly png: Buffer;
  readonly webp: Buffer;
  readonly gif: Buffer;
  readonly svg: Buffer;
  readonly animatedWebp: Buffer;
  readonly tooSmallPng: Buffer;
  readonly pixelLimitPng: Buffer;
  readonly textAsPng: Buffer;
  readonly oversizedPng: Buffer;
}
