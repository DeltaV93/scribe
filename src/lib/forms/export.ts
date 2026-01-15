import { prisma } from "@/lib/db";

/**
 * Form export format
 */
export interface FormExport {
  version: string;
  exportedAt: string;
  form: {
    name: string;
    description: string | null;
    type: string;
    settings: unknown;
  };
  fields: Array<{
    slug: string;
    name: string;
    type: string;
    purpose: string;
    purposeNote: string | null;
    helpText: string | null;
    isRequired: boolean;
    isSensitive: boolean;
    isAiExtractable: boolean;
    options: unknown;
    section: string | null;
    order: number;
    conditionalLogic: unknown;
    translations: unknown;
  }>;
  metadata: {
    fieldCount: number;
    sections: string[];
  };
}

export const EXPORT_VERSION = "1.0";

/**
 * Export a form to JSON format
 */
export async function exportFormToJson(formId: string): Promise<FormExport> {
  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: {
      fields: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!form) {
    throw new Error("Form not found");
  }

  const sections = Array.from(
    new Set(form.fields.map((f) => f.section).filter(Boolean))
  ) as string[];

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    form: {
      name: form.name,
      description: form.description,
      type: form.type,
      settings: form.settings,
    },
    fields: form.fields.map((field) => ({
      slug: field.slug,
      name: field.name,
      type: field.type,
      purpose: field.purpose,
      purposeNote: field.purposeNote,
      helpText: field.helpText,
      isRequired: field.isRequired,
      isSensitive: field.isSensitive,
      isAiExtractable: field.isAiExtractable,
      options: field.options,
      section: field.section,
      order: field.order,
      conditionalLogic: field.conditionalLogic,
      translations: field.translations,
    })),
    metadata: {
      fieldCount: form.fields.length,
      sections,
    },
  };
}

/**
 * Generate a printable HTML version of the form
 */
export async function exportFormToHtml(formId: string): Promise<string> {
  const form = await prisma.form.findUnique({
    where: { id: formId },
    include: {
      fields: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!form) {
    throw new Error("Form not found");
  }

  // Group fields by section
  const sectionedFields = form.fields.reduce((acc, field) => {
    const section = field.section || "General";
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(field);
    return acc;
  }, {} as Record<string, typeof form.fields>);

  const fieldTypeLabels: Record<string, string> = {
    TEXT_SHORT: "Short Text",
    TEXT_LONG: "Long Text",
    NUMBER: "Number",
    DATE: "Date",
    PHONE: "Phone",
    EMAIL: "Email",
    ADDRESS: "Address",
    DROPDOWN: "Selection",
    CHECKBOX: "Multiple Choice",
    YES_NO: "Yes/No",
    FILE: "File Upload",
    SIGNATURE: "Signature",
  };

  const renderField = (field: (typeof form.fields)[0]) => {
    const required = field.isRequired ? '<span style="color: red;">*</span>' : "";
    const inputStyle = `
      width: 100%;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      margin-top: 4px;
    `;

    let inputHtml = "";
    switch (field.type) {
      case "TEXT_LONG":
        inputHtml = `<textarea style="${inputStyle} min-height: 80px;"></textarea>`;
        break;
      case "YES_NO":
        inputHtml = `
          <div style="margin-top: 8px;">
            <label><input type="radio" name="${field.slug}"> Yes</label>
            <label style="margin-left: 16px;"><input type="radio" name="${field.slug}"> No</label>
          </div>
        `;
        break;
      case "CHECKBOX":
        const options = (field.options as string[]) || [];
        inputHtml = `
          <div style="margin-top: 8px;">
            ${options.map((opt) => `<label style="display: block; margin: 4px 0;"><input type="checkbox"> ${opt}</label>`).join("")}
          </div>
        `;
        break;
      case "DROPDOWN":
        const dropdownOptions = (field.options as string[]) || [];
        inputHtml = `
          <select style="${inputStyle}">
            <option value="">Select...</option>
            ${dropdownOptions.map((opt) => `<option>${opt}</option>`).join("")}
          </select>
        `;
        break;
      case "SIGNATURE":
        inputHtml = `
          <div style="${inputStyle} height: 100px; display: flex; align-items: center; justify-content: center; color: #999;">
            Signature
          </div>
        `;
        break;
      case "DATE":
        inputHtml = `<input type="date" style="${inputStyle}">`;
        break;
      default:
        inputHtml = `<input type="text" style="${inputStyle}">`;
    }

    return `
      <div style="margin-bottom: 16px;">
        <label style="font-weight: 500; display: block;">
          ${field.name} ${required}
        </label>
        ${field.helpText ? `<small style="color: #666;">${field.helpText}</small>` : ""}
        ${inputHtml}
      </div>
    `;
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${form.name}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
          line-height: 1.5;
        }
        h1 {
          margin-bottom: 8px;
        }
        .description {
          color: #666;
          margin-bottom: 32px;
        }
        .section {
          margin-bottom: 32px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          border-bottom: 2px solid #333;
          padding-bottom: 8px;
          margin-bottom: 16px;
        }
        .footer {
          margin-top: 48px;
          padding-top: 16px;
          border-top: 1px solid #ccc;
          color: #666;
          font-size: 12px;
        }
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>${form.name}</h1>
      ${form.description ? `<p class="description">${form.description}</p>` : ""}

      ${Object.entries(sectionedFields)
        .map(
          ([section, fields]) => `
        <div class="section">
          <h2 class="section-title">${section}</h2>
          ${fields.map(renderField).join("")}
        </div>
      `
        )
        .join("")}

      <div class="footer">
        <p>Form Type: ${form.type} | Generated: ${new Date().toLocaleDateString()}</p>
      </div>
    </body>
    </html>
  `;

  return html;
}
