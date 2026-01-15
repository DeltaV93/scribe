import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

const BUCKET_NAME = "uploads";

// Lazy initialization to avoid build-time errors
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Supabase configuration missing");
    }

    _supabase = createClient(url, key);
  }
  return _supabase;
}

/**
 * Generate a unique storage path for a file
 */
export function generateStoragePath(
  orgId: string,
  originalName: string
): string {
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString("hex");
  const sanitizedName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .substring(0, 50);

  return `${orgId}/${timestamp}-${randomId}-${sanitizedName}`;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  file: Buffer | Uint8Array,
  storagePath: string,
  mimeType: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error("Storage upload error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, path: data.path };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Get a signed URL for downloading a file
 */
export async function getDownloadUrl(
  storagePath: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      return { error: error.message };
    }

    return { url: data.signedUrl };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to get download URL",
    };
  }
}

/**
 * Get file content as buffer
 */
export async function getFileContent(
  storagePath: string
): Promise<{ data?: Buffer; error?: string }> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (error) {
      return { error: error.message };
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    return { data: buffer };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to get file content",
    };
  }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

/**
 * Check if a file exists in storage
 */
export async function fileExists(storagePath: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(storagePath.split("/").slice(0, -1).join("/"), {
        search: storagePath.split("/").pop(),
      });

    if (error) return false;
    return data.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get file metadata from storage
 */
export async function getFileMetadata(
  storagePath: string
): Promise<{
  size?: number;
  mimeType?: string;
  lastModified?: Date;
  error?: string;
}> {
  try {
    const supabase = getSupabase();
    const pathParts = storagePath.split("/");
    const fileName = pathParts.pop();
    const folderPath = pathParts.join("/");

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folderPath, {
        search: fileName,
      });

    if (error) {
      return { error: error.message };
    }

    const file = data.find((f) => f.name === fileName);
    if (!file) {
      return { error: "File not found" };
    }

    return {
      size: file.metadata?.size,
      mimeType: file.metadata?.mimetype,
      lastModified: file.updated_at ? new Date(file.updated_at) : undefined,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to get metadata",
    };
  }
}
