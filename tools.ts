import { z } from "zod";

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

export const StaticValuesSchema = z
  .record(z.string())
  .optional()
  .describe("Key-value pairs that override STATIC template placeholders, e.g. { country: 'USA' }");

export const PromptJsonSchema = z
  .union([z.record(z.unknown()), z.string()])
  .optional()
  .describe("Custom extraction schema as JSON object or JSON string");

// ─── process_job ─────────────────────────────────────────────────────────────

export const ProcessJobSchema = z.object({
  file_path: z
    .string()
    .describe(
      "Absolute or relative path to the document file on disk (jpg, png, pdf, zip). " +
      "The file will be read and uploaded as multipart/form-data."
    ),
  template_id: z
    .string()
    .uuid()
    .optional()
    .describe("UUID of the DocuProx template to use for extraction"),
  static_values: StaticValuesSchema,
  prompt_json: PromptJsonSchema,
  custom_instructions: z
    .string()
    .optional()
    .describe("Free-text instructions that guide the AI extraction"),
  document_type: z
    .string()
    .optional()
    .describe("Document category, e.g. 'invoice', 'passport'. Required when template_id is omitted."),
});

export type ProcessJobInput = z.infer<typeof ProcessJobSchema>;

// ─── process_agent ───────────────────────────────────────────────────────────

export const ProcessAgentSchema = z.object({
  file_path: z
    .string()
    .describe(
      "Absolute or relative path to the document file on disk. " +
      "The file will be read and uploaded as multipart/form-data."
    ),
  prompt_json: z
    .union([z.record(z.unknown()), z.string()])
    .describe("Extraction schema as JSON object or JSON string. Required."),
  document_type: z
    .string()
    .describe("Document category, e.g. 'invoice', 'passport'. Required."),
  custom_instructions: z
    .string()
    .optional()
    .describe("Free-text instructions to guide extraction"),
  static_values: StaticValuesSchema,
});

export type ProcessAgentInput = z.infer<typeof ProcessAgentSchema>;

// ─── job_status ──────────────────────────────────────────────────────────────

export const JobStatusSchema = z.object({
  job_id: z
    .string()
    .uuid()
    .describe("UUID of the job returned by process_job"),
});

export type JobStatusInput = z.infer<typeof JobStatusSchema>;

// ─── job_results ─────────────────────────────────────────────────────────────

export const JobResultsSchema = z.object({
  job_id: z
    .string()
    .uuid()
    .describe("UUID of the job returned by process_job"),
  result_format: z
    .enum(["json", "csv"])
    .optional()
    .default("json")
    .describe("Format of the results to retrieve, either 'json' or 'csv' (default: 'json')"),
});

export type JobResultsInput = z.infer<typeof JobResultsSchema>;

// ─── poll_job ────────────────────────────────────────────────────────────────

export const PollJobSchema = z.object({
  job_id: z
    .string()
    .uuid()
    .describe("UUID of the job to poll"),
  interval_ms: z
    .number()
    .int()
    .positive()
    .optional()
    .default(3000)
    .describe("How often to check status in milliseconds (default: 3000)"),
  timeout_ms: z
    .number()
    .int()
    .positive()
    .optional()
    .default(300000)
    .describe("Maximum total wait time in milliseconds (default: 300000 = 5 min)"),
});

export type PollJobInput = z.infer<typeof PollJobSchema>;

// ─── MCP tool catalog ────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: "process_job",
    description:
      "Submit a document (image, PDF, or zip) for asynchronous processing via DocuProx. " +
      "Reads the file from disk and uploads it as multipart/form-data. " +
      "Returns a job_id you can track with job_status or poll_job.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description:
            "Absolute or relative path to the document on disk (jpg, png, pdf, zip).",
        },
        template_id: {
          type: "string",
          description: "UUID of the DocuProx template. Omit to use agentic mode.",
        },
        static_values: {
          type: "object",
          description: "Key-value pairs overriding STATIC template placeholders.",
          additionalProperties: { type: "string" },
        },
        prompt_json: {
          description: "Custom extraction schema (JSON object or string).",
        },
        custom_instructions: {
          type: "string",
          description: "Free-text instructions for the AI.",
        },
        document_type: {
          type: "string",
          description: "Document category (required in agentic mode).",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "process_agent",
    description:
      "Submit a document for SYNCHRONOUS agentic extraction via DocuProx. " +
      "Reads the file from disk, uploads as multipart/form-data, and waits for the result. " +
      "Returns the extracted data directly (no job polling needed). " +
      "Credits are deducted and refunded on failure.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Absolute or relative path to the document on disk.",
        },
        prompt_json: {
          description: "Extraction schema (JSON object or string). Required.",
        },
        document_type: {
          type: "string",
          description: "Document category, e.g. 'invoice', 'passport'. Required.",
        },
        custom_instructions: {
          type: "string",
          description: "Free-text instructions to guide extraction.",
        },
        static_values: {
          type: "object",
          description: "Key-value pairs overriding STATIC template placeholders.",
          additionalProperties: { type: "string" },
        },
      },
      required: ["file_path", "prompt_json", "document_type"],
    },
  },
  {
    name: "job_status",
    description:
      "Check the current status of an asynchronous DocuProx processing job. " +
      "Returns the job_id and status string (e.g. NEW, UNZIP FILE, UNZIP FILE SUCCESS, UNZIP FILE FAILED,PROCESS IMAGE, PROCESS IMAGE SUCCESS,PROCESS IMAGE FAILED,SUCCESS,FAILED).",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_id: {
          type: "string",
          description: "UUID of the job returned by process_job.",
        },
      },
      required: ["job_id"],
    },
  },
  {
    name: "job_results",
    description:
      "Fetch the extracted results of a completed asynchronous DocuProx processing job. " +
      "Requires a valid job_id and optionally a format ('json' or 'csv').",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_id: {
          type: "string",
          description: "UUID of the job.",
        },
        result_format: {
          type: "string",
          description: "Format of the results ('json' or 'csv'). Defaults to 'json'.",
        },
      },
      required: ["job_id"],
    },
  },
  {
    name: "poll_job",
    description:
      "Poll an asynchronous DocuProx job until it reaches a terminal status " +
      "(COMPLETED, FAILED, or ERROR) or a timeout is reached. " +
      "Useful to block until a job is done without manual retries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_id: {
          type: "string",
          description: "UUID of the job to poll.",
        },
        interval_ms: {
          type: "number",
          description: "Polling interval in ms (default: 3000).",
        },
        timeout_ms: {
          type: "number",
          description: "Max wait time in ms (default: 300000).",
        },
      },
      required: ["job_id"],
    },
  },
] as const;
