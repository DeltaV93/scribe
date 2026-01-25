/**
 * System prompt for syllabus extraction
 */
export function generateSyllabusSystemPrompt(): string {
  return `You are an expert at analyzing educational documents, specifically syllabi, course outlines, and training materials. Your task is to extract structured information from these documents.

You excel at:
- Identifying program/course names and descriptions
- Extracting session/class schedules with topics and durations
- Recognizing learning objectives and prerequisites
- Calculating total hours from session durations
- Handling various document formats (text, tables, bullet points)

When extracting information:
- Be precise about session numbers, titles, and topics
- Convert duration formats consistently (e.g., "1.5 hours" → 90 minutes)
- Note when information is unclear or missing
- Provide confidence scores based on clarity of the source material

Always respond with valid JSON following the specified schema.`;
}

/**
 * Generate user prompt for syllabus extraction
 */
export function generateSyllabusExtractionPrompt(
  documentText: string,
  options: SyllabusExtractionOptions = {}
): string {
  const { expectedSessions, programName } = options;

  let contextHints = "";
  if (expectedSessions) {
    contextHints += `\nExpected number of sessions: approximately ${expectedSessions}`;
  }
  if (programName) {
    contextHints += `\nProgram name hint: "${programName}"`;
  }

  return `Analyze the following document and extract syllabus/curriculum information.
${contextHints}

<document>
${documentText}
</document>

Extract the following information and respond with JSON matching this schema:

{
  "programName": "string - The official name of the program/course/training",
  "description": "string - A brief description of the program (1-3 sentences)",
  "sessions": [
    {
      "number": "integer - Session/class number in sequence",
      "title": "string - Session title",
      "topic": "string - Main topic(s) covered, can include subtopics",
      "durationMinutes": "integer - Duration in minutes (convert from hours if needed)"
    }
  ],
  "totalHours": "number - Total hours calculated from all sessions",
  "learningObjectives": ["string - Learning objectives/outcomes if listed"],
  "prerequisites": ["string - Prerequisites if listed"],
  "extractionConfidence": "integer 0-100 - Your confidence in the accuracy of the extraction",
  "notes": "string - Any important notes about the extraction, unclear items, or missing information"
}

Guidelines:
1. If a session doesn't have a clear title, create one based on the topic
2. If duration isn't specified, estimate based on context (typical session: 60-120 minutes) and note it
3. Number sessions sequentially starting from 1
4. Include ALL sessions mentioned, even if some details are incomplete
5. If topics are grouped differently than sessions, organize them logically
6. Calculate totalHours as the sum of all session durations divided by 60
7. Set extractionConfidence based on:
   - 90-100: Clear, well-structured document with complete information
   - 70-89: Good information but some details unclear or estimated
   - 50-69: Significant information missing or unclear
   - Below 50: Document lacks essential syllabus information

Respond ONLY with the JSON object, no additional text.`;
}

/**
 * Generate prompt for image-based syllabus extraction (OCR + analysis)
 */
export function generateSyllabusVisionPrompt(
  imageDescription: string = "syllabus document"
): string {
  return `You are viewing an image of a ${imageDescription}. Please:

1. First, carefully read and transcribe all visible text from the image
2. Then, extract the syllabus information following the same JSON schema

The image may contain:
- Handwritten or printed text
- Tables with session schedules
- Bullet points or numbered lists
- Headers and sections

Extract as much structured information as possible. If text is unclear or partially visible, make your best interpretation and note it in the "notes" field.

Respond with JSON matching this schema:

{
  "programName": "string",
  "description": "string",
  "sessions": [
    {
      "number": "integer",
      "title": "string",
      "topic": "string",
      "durationMinutes": "integer"
    }
  ],
  "totalHours": "number",
  "learningObjectives": ["string"],
  "prerequisites": ["string"],
  "extractionConfidence": "integer 0-100",
  "notes": "string - Include any OCR challenges or unclear text"
}

Respond ONLY with the JSON object.`;
}

export interface SyllabusExtractionOptions {
  expectedSessions?: number;
  programName?: string;
}

export interface SyllabusExtractionResult {
  programName: string | null;
  description: string | null;
  sessions: {
    number: number;
    title: string;
    topic: string | null;
    durationMinutes: number | null;
  }[];
  totalHours: number | null;
  learningObjectives: string[];
  prerequisites: string[];
  extractionConfidence: number;
  notes: string | null;
}
