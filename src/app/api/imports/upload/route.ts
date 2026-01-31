/**
 * Import Upload API
 *
 * POST /api/imports/upload - Upload a file for import
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { createImportBatch } from "@/lib/services/imports";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: { id: true, orgId: true, role: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only admins and program managers can import
    if (!["ADMIN", "SUPER_ADMIN", "PROGRAM_MANAGER"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Get the file from form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/json",
    ];

    const extension = file.name.toLowerCase().split(".").pop();
    const allowedExtensions = ["csv", "xlsx", "xls", "json"];

    if (!allowedExtensions.includes(extension || "")) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: CSV, XLSX, JSON" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // TODO: In production, upload to S3 first
    const filePath = `imports/${dbUser.orgId}/${Date.now()}_${file.name}`;

    // Create import batch
    const result = await createImportBatch({
      orgId: dbUser.orgId,
      userId: dbUser.id,
      fileName: file.name,
      filePath,
      fileSize: file.size,
      fileBuffer: buffer,
    });

    if (result.errors.length > 0 && !result.batchId) {
      return NextResponse.json(
        { error: "Failed to parse file", details: result.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({
      batchId: result.batchId,
      fileName: file.name,
      totalRows: result.totalRows,
      columns: result.columns,
      preview: result.preview,
      suggestedMappings: result.suggestedMappings,
      warnings: result.errors,
    });
  } catch (error) {
    console.error("Error uploading import file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
