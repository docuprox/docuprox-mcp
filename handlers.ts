import { DocuProxClient } from "./client.js";
import {
  ProcessJobSchema,
  ProcessAgentSchema,
  JobStatusSchema,
  PollJobSchema,
  JobResultsSchema,
} from "./tools.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function err(message: string, detail?: unknown): ToolResult {
  const body: Record<string, unknown> = { error: message };
  if (detail !== undefined) {
    body.detail = detail instanceof Error ? detail.message : detail;
  }
  return {
    content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
    isError: true,
  };
}

export async function handleTool(
  client: DocuProxClient,
  toolName: string,
  rawArgs: unknown
): Promise<ToolResult> {
  switch (toolName) {
    // ── process_job ──────────────────────────────────────────────────────────
    case "process_job": {
      const parsed = ProcessJobSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return err("Invalid arguments for process_job", parsed.error.format());
      }
      const { file_path, template_id, static_values, prompt_json, custom_instructions, document_type } =
        parsed.data;
      try {
        const result = await client.processJob({
          filePath: file_path,
          templateId: template_id,
          staticValues: static_values,
          promptJson: prompt_json as Record<string, unknown> | string | undefined,
          customInstructions: custom_instructions,
          documentType: document_type,
        });
        return ok(result);
      } catch (e) {
        return err("process_job failed", e);
      }
    }

    // ── process_agent ────────────────────────────────────────────────────────
    case "process_agent": {
      const parsed = ProcessAgentSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return err("Invalid arguments for process_agent", parsed.error.format());
      }
      const { file_path, prompt_json, document_type, custom_instructions, static_values } =
        parsed.data;
      try {
        const result = await client.processAgent({
          filePath: file_path,
          promptJson: prompt_json as Record<string, unknown> | string,
          documentType: document_type,
          customInstructions: custom_instructions,
          staticValues: static_values,
        });
        return ok(result);
      } catch (e) {
        return err("process_agent failed", e);
      }
    }

    // ── job_status ───────────────────────────────────────────────────────────
    case "job_status": {
      const parsed = JobStatusSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return err("Invalid arguments for job_status", parsed.error.format());
      }
      try {
        const result = await client.jobStatus(parsed.data.job_id);
        return ok(result);
      } catch (e) {
        return err("job_status failed", e);
      }
    }

    // ── job_results ──────────────────────────────────────────────────────────
    case "job_results": {
      const parsed = JobResultsSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return err("Invalid arguments for job_results", parsed.error.format());
      }
      const { job_id, result_format } = parsed.data;
      try {
        const result = await client.jobResults({ job_id, result_format });
        return ok(result);
      } catch (e) {
        return err("job_results failed", e);
      }
    }

    // ── poll_job ─────────────────────────────────────────────────────────────
    case "poll_job": {
      const parsed = PollJobSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return err("Invalid arguments for poll_job", parsed.error.format());
      }
      const { job_id, interval_ms, timeout_ms } = parsed.data;
      try {
        const result = await client.pollJobUntilDone(job_id, {
          intervalMs: interval_ms,
          timeoutMs: timeout_ms,
        });
        return ok(result);
      } catch (e) {
        return err("poll_job failed", e);
      }
    }

    default:
      return err(`Unknown tool: ${toolName}`);
  }
}
