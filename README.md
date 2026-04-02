# docuprox-mcp

MCP (Model Context Protocol) server that wraps the **DocuProx** document-processing Flask API and exposes it as tools any MCP-compatible AI client can call (Claude Desktop, Cursor, Windsurf, etc.).

---

## Project Structure

```
docuprox-mcp/
├── src/
│   ├── index.ts        ← MCP server entry point (stdio transport)
│   ├── config.ts       ← Env-var config loader
│   ├── client.ts       ← Axios API client (reads files, sends multipart/form-data)
│   ├── tools.ts        ← Zod schemas + MCP tool definitions
│   └── handlers.ts     ← Maps tool names → client calls
├── package.json
├── tsconfig.json
└── README.md
```

---

## Installation

### From source

```bash
git clone <repo>
cd docuprox-mcp
npm install
npm run build
```

### Via npx (no install needed)

```bash
npx docuprox-mcp
```

---

## Configuration

The server reads two environment variables:

| Variable              | Required | Default                    | Description                          |
|-----------------------|----------|----------------------------|--------------------------------------|
| `DOCUPROX_API_KEY`    | ✅ yes   | —                          | Your DocuProx API key                |
| `DOCUPROX_BASE_URL`   | no       | `https://api.docuprox.com` | Base URL of your Flask API           |

---

## Connecting to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "docuprox": {
      "command": "npx",
      "args": ["docuprox-mcp"],
      "env": {
        "DOCUPROX_API_KEY": "your_api_key_here",
        "DOCUPROX_BASE_URL": "https://your-flask-api.com"
      }
    }
  }
}
```

Or if running from source:

```json
{
  "mcpServers": {
    "docuprox": {
      "command": "node",
      "args": ["/absolute/path/to/docuprox-mcp/dist/index.js"],
      "env": {
        "DOCUPROX_API_KEY": "your_api_key_here",
        "DOCUPROX_BASE_URL": "http://localhost:5000"
      }
    }
  }
}
```

---

## Available Tools

### `process_job`

Submit a document for **asynchronous** processing. Returns a `job_id` to track later.

| Argument             | Type    | Required | Description                                           |
|----------------------|---------|----------|-------------------------------------------------------|
| `file_path`          | string  | ✅       | Path to file on disk (jpg, png, pdf, zip)             |
| `template_id`        | string  | no       | UUID of DocuProx template                             |
| `static_values`      | object  | no       | Key-value overrides for STATIC template placeholders  |
| `prompt_json`        | any     | no       | Custom extraction schema                              |
| `custom_instructions`| string  | no       | Free-text guidance for the AI                         |
| `document_type`      | string  | no*      | Document category (required if no `template_id`)      |

**Example prompt to Claude:**
> "Submit the invoice at `/tmp/invoice.pdf` using template `123e4567-e89b-12d3-a456-426614174000`"

---

### `process_agent`

Submit a document for **synchronous** extraction. Blocks and returns the result directly — no polling needed. Credits are automatically refunded on failure.

| Argument             | Type    | Required | Description                          |
|----------------------|---------|----------|--------------------------------------|
| `file_path`          | string  | ✅       | Path to file on disk                 |
| `prompt_json`        | any     | ✅       | Extraction schema                    |
| `document_type`      | string  | ✅       | Document category                    |
| `custom_instructions`| string  | no       | Free-text guidance                   |
| `static_values`      | object  | no       | Key-value STATIC overrides           |

**Example prompt to Claude:**
> "Extract the passport data from `/home/user/passport.jpg`. Use document_type='passport' and prompt_json `{ 'name': 'full name on document', 'dob': 'date of birth' }`"

---

### `job_status`

Check status of an async job.

| Argument  | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `job_id`  | string | ✅       | UUID from `process_job`  |

Returns: `{ job_id, status }` — status is one of `NEW`, `PROCESSING`, `COMPLETED`, `FAILED`.

---

### `poll_job`

Block until a job finishes (or times out). Internally retries `job_status` on a timer.

| Argument      | Type   | Required | Default    | Description               |
|---------------|--------|----------|------------|---------------------------|
| `job_id`      | string | ✅       | —          | UUID from `process_job`   |
| `interval_ms` | number | no       | `3000`     | Poll interval in ms       |
| `timeout_ms`  | number | no       | `300000`   | Max wait in ms (5 min)    |

**Example prompt to Claude:**
> "Submit `/tmp/batch.zip` then wait for the result"  
> Claude will call `process_job`, then `poll_job` automatically.

---

## How File Uploads Work

Every tool that accepts a `file_path`:
1. Resolves the path to an absolute path
2. Reads the file into a `Buffer`
3. Detects the MIME type from the file extension
4. Sends it as `multipart/form-data` with `actual_image` as the field name

This matches exactly what the Flask API expects. The AI never needs to see or handle base64 — just pass a path.

---

## Development

```bash
# Run in dev mode (ts-node, no build step)
DOCUPROX_API_KEY=test DOCUPROX_BASE_URL=http://localhost:5000 npm run dev

# Build
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Error Handling

- **File not found** → clear error message with resolved path
- **API errors** → HTTP status + response body surfaced in tool result
- **Invalid arguments** → Zod validation errors returned before any API call
- **Credit failures** → 402/403 responses from `/process-agent` surfaced clearly
