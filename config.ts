export interface DocuProxConfig {
  apiKey: string;
  baseUrl: string;
}

export function loadConfig(): DocuProxConfig {
  const apiKey = process.env.DOCUPROX_API_KEY;
  const baseUrl = process.env.DOCUPROX_BASE_URL || "https://api.docuprox.com";

  if (!apiKey) {
    throw new Error(
      "DOCUPROX_API_KEY environment variable is required.\n" +
      "Set it via: export DOCUPROX_API_KEY=your_key_here\n" +
      "Or pass it in your MCP client config."
    );
  }

  return { apiKey, baseUrl: baseUrl.replace(/\/$/, "") };
}
