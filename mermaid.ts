import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

// Construct server URL with authentication
const url = new URL("https://server.smithery.ai/@antvis/mcp-server-chart/mcp")
const key = process.env.SENTRY_KEY
if (!key) {
  console.log("the sentry key not found")
}
url.searchParams.set("api_key", key!)
const serverUrl = url.toString()

const transport = new StreamableHTTPClientTransport(new URL(serverUrl))

// Create MCP client
import { Client } from "@modelcontextprotocol/sdk/client/index.js"

const client = new Client({
  name: "mermaidMcpClient",
  version: "1.0.0"
})
await client.connect(transport)

// List available tools
const tools = await client.listTools()
console.log(`Available tools: ${tools.tools?.map((t: any) => t.name).join(", ") || "No tools available"}`)
