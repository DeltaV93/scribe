import QRCode from "qrcode";

export interface QRCodeOptions {
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  margin?: number;
  width?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

const DEFAULT_OPTIONS: QRCodeOptions = {
  errorCorrectionLevel: "H", // High error correction for better scanning from photos
  margin: 1,
  width: 100,
  color: {
    dark: "#000000",
    light: "#FFFFFF",
  },
};

/**
 * Generate QR code as data URL (base64 encoded PNG)
 */
export async function generateQRCodeDataUrl(
  data: string,
  options?: QRCodeOptions
): Promise<string> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const dataUrl = await QRCode.toDataURL(data, {
    errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
    margin: mergedOptions.margin,
    width: mergedOptions.width,
    color: mergedOptions.color,
  });

  return dataUrl;
}

/**
 * Generate QR code as Buffer (PNG)
 */
export async function generateQRCodeBuffer(
  data: string,
  options?: QRCodeOptions
): Promise<Buffer> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const buffer = await QRCode.toBuffer(data, {
    errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
    margin: mergedOptions.margin,
    width: mergedOptions.width,
    color: mergedOptions.color,
    type: "png",
  });

  return buffer;
}

/**
 * Generate attendance QR code content
 * Format: SCRYBE:ATT:{enrollmentId}:{attendanceCode}
 */
export function formatAttendanceQRContent(
  enrollmentId: string,
  attendanceCode: string
): string {
  return `SCRYBE:ATT:${enrollmentId}:${attendanceCode}`;
}

/**
 * Parse attendance QR code content
 */
export function parseAttendanceQRContent(
  content: string
): { enrollmentId: string; attendanceCode: string } | null {
  const parts = content.split(":");
  if (parts.length !== 4 || parts[0] !== "SCRYBE" || parts[1] !== "ATT") {
    return null;
  }
  return {
    enrollmentId: parts[2],
    attendanceCode: parts[3],
  };
}

/**
 * Generate QR code for attendance with enrollment info
 */
export async function generateAttendanceQRCode(
  enrollmentId: string,
  attendanceCode: string,
  options?: QRCodeOptions
): Promise<string> {
  const content = formatAttendanceQRContent(enrollmentId, attendanceCode);
  return generateQRCodeDataUrl(content, options);
}
