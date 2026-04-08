# docuprox-mcp

MCP (Model Context Protocol) server for the **DocuProx** document-processing API. Exposes DocuProx as tools that any MCP-compatible AI client can call — Claude Desktop, Claude Code, Cursor, Windsurf, and more.

---

## Quickstart (npx — no install required)

```bash
DOCUPROX_API_KEY=your_key DOCUPROX_BASE_URL=https://api.docuprox.com/v1 npx docuprox-mcp
```

Requires **Node.js ≥ 18**.

---

## Configuration

| Variable            | Required | Description              |
|---------------------|----------|--------------------------|
| `DOCUPROX_API_KEY`  | yes      | Your DocuProx API key    |
| `DOCUPROX_BASE_URL` | yes      | Base URL of the DocuProx API (e.g. `https://api.docuprox.com/v1`) |

---

## Connect to an MCP Client

### Claude Desktop

**macOS** — `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows** — `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "docuprox": {
      "command": "npx",
      "args": ["docuprox-mcp"],
      "env": {
        "DOCUPROX_API_KEY": "your_api_key_here",
        "DOCUPROX_BASE_URL": "https://api.docuprox.com/v1"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add docuprox -e DOCUPROX_API_KEY=your_api_key_here -e DOCUPROX_BASE_URL=https://api.docuprox.com/v1 -- npx docuprox-mcp
```

### Cursor / Windsurf

Add to your MCP settings (`.cursor/mcp.json` or equivalent):

```json
{
  "mcpServers": {
    "docuprox": {
      "command": "npx",
      "args": ["docuprox-mcp"],
      "env": {
        "DOCUPROX_API_KEY": "your_api_key_here",
        "DOCUPROX_BASE_URL": "https://api.docuprox.com/v1"
      }
    }
  }
}
```

---

## Available Tools

### `process_job`

Submit a document for **asynchronous** processing. Returns a `job_id` to track with `poll_job` or `job_results`.

| Argument              | Type   | Required | Description                                          |
|-----------------------|--------|----------|------------------------------------------------------|
| `file_path`           | string | yes      | Path to file on disk (jpg, png, pdf, zip)            |
| `template_id`         | string | no       | UUID of a DocuProx template                          |
| `document_type`       | string | no*      | Document category — required when no `template_id`   |
| `prompt_json`         | object | no       | Custom extraction schema                             |
| `custom_instructions` | string | no       | Free-text guidance for the AI                        |
| `static_values`       | object | no       | Key-value overrides for STATIC template placeholders |

> **Example:** "Submit the invoice at `/tmp/invoice.pdf` using template `123e4567-e89b-12d3-a456-426614174000`"

---

### `process_agent`

Submit a document for **synchronous** extraction. Blocks until done and returns results directly — no polling needed. Credits are automatically refunded on failure.

| Argument              | Type   | Required | Description                          |
|-----------------------|--------|----------|--------------------------------------|
| `file_path`           | string | yes      | Path to file on disk                 |
| `prompt_json`         | object | yes      | Extraction schema                    |
| `document_type`       | string | yes      | Document category                    |
| `custom_instructions` | string | no       | Free-text guidance                   |
| `static_values`       | object | no       | Key-value STATIC overrides           |

> **Example:** "Extract passport data from `/home/user/passport.jpg`. Use document_type='passport' and prompt_json `{ 'name': 'full name', 'dob': 'date of birth' }`"

---

### `job_status`

Check the status of an async job.

| Argument | Type   | Required | Description             |
|----------|--------|----------|-------------------------|
| `job_id` | string | yes      | UUID from `process_job` |

Returns: `{ job_id, status }` where status is one of:
`NEW` → `UNZIP FILE` → `UNZIP FILE SUCCESS / UNZIP FILE FAILED` → `PROCESS IMAGE` → `PROCESS IMAGE SUCCESS / PROCESS IMAGE FAILED` → `SUCCESS / FAILED`

---

### `poll_job`

Block until a job finishes (or times out). Retries `job_status` internally on a timer.

| Argument      | Type   | Required | Default  | Description             |
|---------------|--------|----------|----------|-------------------------|
| `job_id`      | string | yes      | —        | UUID from `process_job` |
| `interval_ms` | number | no       | `3000`   | Poll interval in ms     |
| `timeout_ms`  | number | no       | `300000` | Max wait in ms (5 min)  |

> **Example:** "Submit `/tmp/batch.zip` then wait for the result" — Claude will call `process_job` then `poll_job` automatically.

---

### `job_results`

Fetch the extracted results of a completed async job.

| Argument        | Type   | Required | Default  | Description                              |
|-----------------|--------|----------|----------|------------------------------------------|
| `job_id`        | string | yes      | —        | UUID from `process_job`                  |
| `result_format` | string | no       | `"json"` | Output format: `"json"` or `"csv"`       |

> **Example:** "Get the results for job `0869d5ec-5cfe-4960-878d-8b4ec1900726` in CSV format"

---

## How File Uploads Work

Every tool that accepts a `file_path`:
1. Resolves it to an absolute path
2. Reads the file into a `Buffer`
3. Detects MIME type from the file extension
4. Sends it as `multipart/form-data` with field name `actual_image`

The AI never sees or handles base64 — just pass a local file path.

---

## Error Handling

| Error | Cause |
|-------|-------|
| File not found | `file_path` does not exist — a clear message with the resolved path is returned |
| API error | HTTP status + response body surfaced in the tool result |
| Invalid arguments | Zod validation fires before any API call |
| Credit failure | 402/403 from `/process-agent` surfaced clearly |

---

## Local Development

```bash
# Clone and install
git clone <repo>
cd docuprox-mcp
npm install

# Run in dev mode (no build step)
DOCUPROX_API_KEY=test DOCUPROX_BASE_URL=http://localhost:5000/v1 npm run dev

# Build
npm run build

# Inspect with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

### Project Structure

```
docuprox-mcp/
├── index.ts        ← MCP server entry point (stdio transport)
├── config.ts       ← Env-var config loader
├── client.ts       ← Axios API client (multipart/form-data uploads)
├── tools.ts        ← Zod schemas + MCP tool definitions
├── handlers.ts     ← Maps tool names → client calls
├── package.json
└── tsconfig.json
```

---

## License

MIT
