// mcp/antv.ts
import { experimental_createMCPClient as createMCPClient } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export async function createMermaidMcp() {
  const url = new URL('https://server.smithery.ai/@antvis/mcp-server-chart/mcp');
  url.searchParams.set('api_key', process.env.SENTRY_KEY!);
  const transport = new StreamableHTTPClientTransport(url);
  return await createMCPClient({ transport });
}
