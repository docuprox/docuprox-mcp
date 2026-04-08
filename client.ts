import axios, { AxiosInstance, AxiosResponse } from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import { DocuProxConfig } from "./config.js";

export interface ProcessJobResponse {
  job_id: string;
  template_id: string | null;
  static_values: Record<string, string> | null;
}

export interface JobStatusResponse {
  job_id: string;
  status: string;
}

export interface ProcessAgentResponse {
  [key: string]: unknown;
}

export interface ProcessJobPayload {
  filePath: string;
  templateId?: string;
  staticValues?: Record<string, string>;
  promptJson?: Record<string, unknown> | string;
  customInstructions?: string;
  documentType?: string;
}

export interface ProcessAgentPayload {
  filePath: string;
  promptJson: Record<string, unknown> | string;
  documentType: string;
  customInstructions?: string;
  staticValues?: Record<string, string>;
}

function readFileAsBuffer(filePath: string): { buffer: Buffer; filename: string; mimeType: string } {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }

  const buffer = fs.readFileSync(resolved);
  const filename = path.basename(resolved);
  const mimeType = mime.lookup(resolved) || "application/octet-stream";

  return { buffer, filename, mimeType };
}

export class DocuProxClient {
  private http: AxiosInstance;

  constructor(private config: DocuProxConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl,
      headers: {
        "x-auth": config.apiKey,
      },
      timeout: 120_000,
    });
  }

  /**
   * Submit a document processing job.
   * Reads the file at filePath and sends it as multipart/form-data.
   */
  async processJob(payload: ProcessJobPayload): Promise<ProcessJobResponse> {
    const { buffer, filename, mimeType } = readFileAsBuffer(payload.filePath);

    const form = new FormData();
    form.append("actual_image", buffer, { filename, contentType: mimeType });

    if (payload.templateId) {
      form.append("template_id", payload.templateId);
    }

    if (payload.staticValues) {
      form.append("static_values", JSON.stringify(payload.staticValues));
    }

    // Build payload object for prompt_json / custom_instructions / document_type
    const innerPayload: Record<string, unknown> = {};

    if (payload.promptJson) {
      innerPayload.prompt_json =
        typeof payload.promptJson === "string"
          ? payload.promptJson
          : JSON.stringify(payload.promptJson);
    }

    if (payload.customInstructions) {
      innerPayload.custom_instructions = payload.customInstructions;
    }

    if (payload.documentType) {
      innerPayload.document_type = payload.documentType;
    }

    if (Object.keys(innerPayload).length > 0) {
      form.append("payload", JSON.stringify(innerPayload));
    }

    const response: AxiosResponse<ProcessJobResponse> = await this.http.post(
      "/process-job",
      form,
      { headers: form.getHeaders() }
    );

    return response.data;
  }

  /**
   * Submit a document for synchronous agent processing.
   * Reads the file at filePath and sends it as multipart/form-data.
   */
  async processAgent(payload: ProcessAgentPayload): Promise<ProcessAgentResponse> {
    const { buffer, filename, mimeType } = readFileAsBuffer(payload.filePath);

    const form = new FormData();
    form.append("actual_image", buffer, { filename, contentType: mimeType });

    const innerPayload: Record<string, unknown> = {
      prompt_json:
        typeof payload.promptJson === "string"
          ? payload.promptJson
          : JSON.stringify(payload.promptJson),
      document_type: payload.documentType,
    };

    if (payload.customInstructions) {
      innerPayload.custom_instructions = payload.customInstructions;
    }

    if (payload.staticValues) {
      innerPayload.static_values = payload.staticValues;
    }

    form.append("payload", JSON.stringify(innerPayload));

    const response: AxiosResponse<ProcessAgentResponse> = await this.http.post(
      "/process-agent",
      form,
      { headers: form.getHeaders() }
    );

    return response.data;
  }

  /**
   * Poll the status of a previously submitted job.
   */
  async jobStatus(jobId: string): Promise<JobStatusResponse> {
    const response: AxiosResponse<JobStatusResponse> = await this.http.get(
      "/job-status",
      { params: { job_id: jobId } }
    );
    return response.data;
  }

  /**
   * Fetch the results of a completed job.
   */
  async jobResults(payload: { job_id: string; result_format?: string }): Promise<unknown> {
    const response = await this.http.post(
      "/job-results",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  }

  /**
   * Poll job until terminal status or timeout (ms).
   */
  async pollJobUntilDone(
    jobId: string,
    options: { intervalMs?: number; timeoutMs?: number } = {}
  ): Promise<JobStatusResponse> {
    const intervalMs = options.intervalMs ?? 3000;
    const timeoutMs = options.timeoutMs ?? 300_000; // 5 min default
    const terminalStatuses = new Set(["COMPLETED", "FAILED", "ERROR"]);

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await this.jobStatus(jobId);
      if (terminalStatuses.has(status.status.toUpperCase())) {
        return status;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
  }
}
