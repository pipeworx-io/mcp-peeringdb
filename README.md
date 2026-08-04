# mcp-peeringdb

PeeringDB MCP — the peering ecosystem database.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_networks` | Look up networks in PeeringDB by name or ASN. Returns peering policy (Open/Selective/Restrictive), traffic level, info type (Content/NSP/ISP/Enterprise), scope, and IPv4/IPv6 prefix counts. Provide a name query or an ASN. Keyless. |
| `search_exchanges` | Find internet exchanges (IXes) in PeeringDB by name, city, or country (2-letter code). Returns the IX name, location, continent region, member network count, and website. Provide at least one of query/city/country. Keyless. |
| `search_facilities` | Find colocation facilities (data centers) in PeeringDB by name, city, or country (2-letter code). Returns the facility name, location, network count, street address, and website. Provide at least one of query/city/country. Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "peeringdb": {
      "url": "https://gateway.pipeworx.io/peeringdb/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Peeringdb data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
