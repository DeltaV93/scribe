import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import type { AttendanceSheetData } from "@/lib/services/attendance/types";

// Lazy-load pdfmake to handle ESM/CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pdfmake: any = null;

async function getPdfMake() {
  if (!_pdfmake) {
    // Dynamic import for better compatibility
    // pdfmake exports a singleton instance in Node.js
    const pdfmakeModule = await import("pdfmake");
    _pdfmake = pdfmakeModule.default || pdfmakeModule;

    // Load standard Helvetica fonts from pdfmake's build directory
    // The font file contains a vfs object with font metric data
    // @ts-expect-error - no type declarations for font files
    const HelveticaFont = await import("pdfmake/build/standard-fonts/Helvetica");
    const fontData = HelveticaFont.default || HelveticaFont;

    // Register font data in pdfmake's virtual file system
    if (fontData.vfs) {
      for (const [filename, content] of Object.entries(fontData.vfs)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fileContent = (content as any).data || content;
        _pdfmake.virtualfs.writeFileSync(filename, fileContent);
      }
    }

    // Define the font families for pdfmake to use
    _pdfmake.fonts = {
      Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
      },
    };
  }

  return _pdfmake;
}

/**
 * Format date for display on attendance sheet
 */
function formatDate(date: Date | null): string {
  if (!date) return "________________";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format time for display
 */
function formatTime(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Generate the header section of the attendance sheet
 */
function generateHeader(data: AttendanceSheetData): Content[] {
  return [
    {
      text: data.program.name.toUpperCase(),
      style: "header",
      alignment: "center",
      margin: [0, 0, 0, 5],
    },
    {
      text: "ATTENDANCE SHEET",
      style: "subheader",
      alignment: "center",
      margin: [0, 0, 0, 15],
    },
    {
      columns: [
        {
          width: "*",
          stack: [
            {
              text: [
                { text: "Session: ", bold: true },
                `#${data.session.sessionNumber} - ${data.session.title}`,
              ],
            },
            {
              text: [
                { text: "Date: ", bold: true },
                formatDate(data.session.date),
              ],
              margin: [0, 5, 0, 0],
            },
          ],
        },
        {
          width: "*",
          stack: [
            {
              text: [
                { text: "Duration: ", bold: true },
                data.session.durationMinutes
                  ? `${data.session.durationMinutes} minutes`
                  : "________________",
              ],
              alignment: "right",
            },
            {
              text: [
                { text: "Facilitator: ", bold: true },
                "________________",
              ],
              alignment: "right",
              margin: [0, 5, 0, 0],
            },
          ],
        },
      ],
      margin: [0, 0, 0, 15],
    },
  ];
}

/**
 * Generate table headers based on config
 */
function generateTableHeaders(data: AttendanceSheetData): TableCell[] {
  const headers: TableCell[] = [
    { text: "#", style: "tableHeader", alignment: "center" },
    { text: "QR", style: "tableHeader", alignment: "center" },
    { text: "Code", style: "tableHeader", alignment: "center" },
    { text: "Name", style: "tableHeader" },
    {
      text: "Present",
      style: "tableHeader",
      alignment: "center",
    },
    {
      text: "Excused",
      style: "tableHeader",
      alignment: "center",
    },
  ];

  if (data.config.includeTimeInOut) {
    headers.push(
      { text: "Time In", style: "tableHeader", alignment: "center" },
      { text: "Time Out", style: "tableHeader", alignment: "center" }
    );
  }

  if (data.config.includeClientSignature) {
    headers.push({ text: "Signature", style: "tableHeader", alignment: "center" });
  }

  if (data.config.includeNotes) {
    headers.push({ text: "Notes", style: "tableHeader" });
  }

  return headers;
}

/**
 * Generate a single attendance row
 */
function generateAttendanceRow(
  enrollment: AttendanceSheetData["enrollments"][0],
  index: number,
  config: AttendanceSheetData["config"]
): TableCell[] {
  const row: TableCell[] = [
    { text: (index + 1).toString(), alignment: "center", margin: [0, 8, 0, 8] },
    {
      image: enrollment.qrCodeDataUrl,
      width: 40,
      height: 40,
      alignment: "center",
    },
    {
      text: enrollment.attendanceCode,
      alignment: "center",
      fontSize: 10,
      bold: true,
      margin: [0, 15, 0, 15],
    },
    {
      text: enrollment.clientName,
      margin: [5, 15, 5, 15],
    },
    {
      // Present checkbox
      text: "☐",
      fontSize: 16,
      alignment: "center",
      margin: [0, 12, 0, 12],
    },
    {
      // Excused checkbox
      text: "☐",
      fontSize: 16,
      alignment: "center",
      margin: [0, 12, 0, 12],
    },
  ];

  if (config.includeTimeInOut) {
    row.push(
      { text: "_______", alignment: "center", margin: [0, 15, 0, 15] },
      { text: "_______", alignment: "center", margin: [0, 15, 0, 15] }
    );
  }

  if (config.includeClientSignature) {
    row.push({ text: "", margin: [0, 15, 0, 15] }); // Empty cell for signature
  }

  if (config.includeNotes) {
    row.push({ text: "", margin: [0, 15, 0, 15] }); // Empty cell for notes
  }

  return row;
}

/**
 * Calculate column widths based on config
 */
function calculateColumnWidths(config: AttendanceSheetData["config"]): (string | number)[] {
  const widths: (string | number)[] = [
    20, // #
    50, // QR
    45, // Code
    "*", // Name (flexible)
    40, // Present
    40, // Excused
  ];

  if (config.includeTimeInOut) {
    widths.push(50, 50); // Time In, Time Out
  }

  if (config.includeClientSignature) {
    widths.push(80); // Signature
  }

  if (config.includeNotes) {
    widths.push(80); // Notes
  }

  return widths;
}

/**
 * Generate the attendance table
 */
function generateAttendanceTable(data: AttendanceSheetData): Content {
  const headers = generateTableHeaders(data);
  const rows = data.enrollments.map((enrollment, index) =>
    generateAttendanceRow(enrollment, index, data.config)
  );

  // Add empty rows if needed (minimum 15 rows for walk-ins)
  const minRows = 15;
  const emptyRowsNeeded = Math.max(0, minRows - data.enrollments.length);
  for (let i = 0; i < emptyRowsNeeded; i++) {
    const rowIndex = data.enrollments.length + i;
    const emptyRow: TableCell[] = [
      { text: (rowIndex + 1).toString(), alignment: "center", margin: [0, 15, 0, 15] },
      { text: "", margin: [0, 15, 0, 15] }, // QR (empty for walk-ins)
      { text: "", margin: [0, 15, 0, 15] }, // Code
      { text: "", margin: [0, 15, 0, 15] }, // Name
      { text: "☐", fontSize: 16, alignment: "center", margin: [0, 12, 0, 12] },
      { text: "☐", fontSize: 16, alignment: "center", margin: [0, 12, 0, 12] },
    ];

    if (data.config.includeTimeInOut) {
      emptyRow.push(
        { text: "_______", alignment: "center", margin: [0, 15, 0, 15] },
        { text: "_______", alignment: "center", margin: [0, 15, 0, 15] }
      );
    }

    if (data.config.includeClientSignature) {
      emptyRow.push({ text: "", margin: [0, 15, 0, 15] });
    }

    if (data.config.includeNotes) {
      emptyRow.push({ text: "", margin: [0, 15, 0, 15] });
    }

    rows.push(emptyRow);
  }

  return {
    table: {
      headerRows: 1,
      widths: calculateColumnWidths(data.config),
      body: [headers, ...rows],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#cccccc",
      vLineColor: () => "#cccccc",
      fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f0f0f0" : null),
    },
  };
}

/**
 * Generate instructions section
 */
function generateInstructions(data: AttendanceSheetData): Content[] {
  const instructions: string[] = [
    "Mark ☑ in 'Present' column for attendees who are present.",
    "Mark ☑ in 'Excused' column for excused absences (leave both blank for unexcused absence).",
  ];

  if (data.config.includeTimeInOut) {
    instructions.push("Record time in/out for accurate hours tracking.");
  }

  if (data.config.includeClientSignature) {
    instructions.push("Have each attendee sign in the signature column.");
  }

  if (data.config.customInstructions) {
    instructions.push(data.config.customInstructions);
  }

  return [
    {
      text: "Instructions:",
      bold: true,
      margin: [0, 15, 0, 5],
    },
    {
      ul: instructions,
      fontSize: 9,
      margin: [0, 0, 0, 10],
    },
  ];
}

/**
 * Generate footer section
 */
function generateFooter(data: AttendanceSheetData): Content[] {
  return [
    {
      columns: [
        {
          width: "*",
          text: [
            { text: "Facilitator Signature: ", bold: true },
            "________________________________",
          ],
        },
        {
          width: "*",
          text: [{ text: "Date: ", bold: true }, "________________"],
          alignment: "right",
        },
      ],
      margin: [0, 20, 0, 0],
    },
    {
      text: `Generated: ${formatDate(data.generatedAt)} at ${formatTime(data.generatedAt)}`,
      fontSize: 8,
      color: "#888888",
      alignment: "right",
      margin: [0, 30, 0, 0],
    },
  ];
}

/**
 * Generate complete attendance sheet PDF
 */
export async function generateAttendanceSheetPdf(
  data: AttendanceSheetData
): Promise<Buffer> {
  const docDefinition: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageOrientation: "landscape",
    pageMargins: [40, 40, 40, 40],
    defaultStyle: {
      font: "Helvetica",
      fontSize: 10,
    },
    styles: {
      header: {
        fontSize: 18,
        bold: true,
      },
      subheader: {
        fontSize: 14,
        bold: true,
        color: "#666666",
      },
      tableHeader: {
        bold: true,
        fontSize: 9,
        fillColor: "#f0f0f0",
        margin: [0, 8, 0, 8],
      },
    },
    content: [
      ...generateHeader(data),
      generateAttendanceTable(data),
      ...generateInstructions(data),
      ...generateFooter(data),
    ],
  };

  const pdfmake = await getPdfMake();
  const pdf = pdfmake.createPdf(docDefinition);

  // pdfmake's getBuffer uses a callback pattern, not Promises
  return new Promise<Buffer>((resolve, reject) => {
    try {
      pdf.getBuffer((buffer: Uint8Array) => {
        resolve(Buffer.from(buffer));
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate filename for attendance sheet
 */
export function generateAttendanceSheetFilename(
  programName: string,
  sessionNumber: number,
  date: Date | null
): string {
  const sanitizedName = programName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const dateStr = date
    ? date.toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  return `attendance-${sanitizedName}-session-${sessionNumber}-${dateStr}.pdf`;
}
