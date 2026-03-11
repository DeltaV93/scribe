import sharp from "sharp";

export interface ImageEnhancementOptions {
  normalizeContrast?: boolean;
  sharpen?: boolean;
  denoise?: boolean;
  grayscale?: boolean;
  deskew?: boolean;
  targetWidth?: number;
}

const DEFAULT_OPTIONS: ImageEnhancementOptions = {
  normalizeContrast: true,
  sharpen: true,
  denoise: true,
  grayscale: false, // Keep color for QR code detection
  targetWidth: 2000, // Good balance of quality and file size
};

/**
 * Enhance an attendance photo for better AI recognition
 */
export async function enhanceAttendancePhoto(
  inputBuffer: Buffer,
  options: ImageEnhancementOptions = {}
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let pipeline = sharp(inputBuffer);

  // Get metadata first
  const metadata = await pipeline.metadata();

  // Auto-rotate based on EXIF orientation
  pipeline = pipeline.rotate();

  // Resize if needed (maintain aspect ratio)
  if (opts.targetWidth && metadata.width && metadata.width > opts.targetWidth) {
    pipeline = pipeline.resize(opts.targetWidth, null, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Normalize/enhance contrast
  if (opts.normalizeContrast) {
    pipeline = pipeline.normalize();
  }

  // Sharpen for better text/QR recognition
  if (opts.sharpen) {
    pipeline = pipeline.sharpen({
      sigma: 1.0,
      m1: 1.0,
      m2: 0.5,
    });
  }

  // Denoise
  if (opts.denoise) {
    // Slight blur to reduce noise, then sharpen back
    pipeline = pipeline.median(1);
  }

  // Convert to grayscale if requested
  if (opts.grayscale) {
    pipeline = pipeline.grayscale();
  }

  // Output as JPEG with good quality
  return pipeline
    .jpeg({
      quality: 90,
      mozjpeg: true,
    })
    .toBuffer();
}

/**
 * Get image quality metrics
 */
export async function getImageQualityMetrics(
  inputBuffer: Buffer
): Promise<{
  width: number;
  height: number;
  format: string | undefined;
  sizeBytes: number;
  isBlurry: boolean;
  isTooDark: boolean;
  isTooSmall: boolean;
  qualityScore: number;
}> {
  const metadata = await sharp(inputBuffer).metadata();
  const stats = await sharp(inputBuffer).stats();

  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const format = metadata.format;
  const sizeBytes = inputBuffer.length;

  // Calculate quality indicators
  // Check if image is too small for good recognition
  const minDimension = Math.min(width, height);
  const isTooSmall = minDimension < 800;

  // Check if image might be blurry (based on sharpness estimation)
  // Low standard deviation in channels can indicate blur
  const channelStdDevs = stats.channels.map((c) => c.stdev);
  const avgStdDev = channelStdDevs.reduce((a, b) => a + b, 0) / channelStdDevs.length;
  const isBlurry = avgStdDev < 30;

  // Check if image is too dark
  const channelMeans = stats.channels.map((c) => c.mean);
  const avgMean = channelMeans.reduce((a, b) => a + b, 0) / channelMeans.length;
  const isTooDark = avgMean < 50;

  // Calculate overall quality score (0-100)
  let qualityScore = 100;
  if (isTooSmall) qualityScore -= 30;
  if (isBlurry) qualityScore -= 25;
  if (isTooDark) qualityScore -= 20;
  qualityScore = Math.max(0, qualityScore);

  return {
    width,
    height,
    format,
    sizeBytes,
    isBlurry,
    isTooDark,
    isTooSmall,
    qualityScore,
  };
}

/**
 * Prepare image for Claude Vision API
 * Converts to base64 data URL
 */
export async function prepareImageForVision(
  inputBuffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<string> {
  // Ensure it's in a supported format (JPEG, PNG, GIF, WEBP)
  const supportedFormats = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  if (!supportedFormats.includes(mimeType)) {
    // Convert to JPEG
    const convertedBuffer = await sharp(inputBuffer)
      .jpeg({ quality: 90 })
      .toBuffer();
    return `data:image/jpeg;base64,${convertedBuffer.toString("base64")}`;
  }

  return `data:${mimeType};base64,${inputBuffer.toString("base64")}`;
}

/**
 * Extract a region from the image (e.g., for focusing on specific rows)
 */
export async function extractRegion(
  inputBuffer: Buffer,
  left: number,
  top: number,
  width: number,
  height: number
): Promise<Buffer> {
  return sharp(inputBuffer)
    .extract({ left, top, width, height })
    .toBuffer();
}

/**
 * Resize image to fit within constraints while maintaining aspect ratio
 */
export async function resizeImage(
  inputBuffer: Buffer,
  maxWidth: number,
  maxHeight: number
): Promise<Buffer> {
  return sharp(inputBuffer)
    .resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}
