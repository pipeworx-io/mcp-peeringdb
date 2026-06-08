interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * PeeringDB MCP — the peering ecosystem database.
 * Look up networks by name or ASN, find internet exchanges (IXes) and
 * colocation facilities by name/city/country. Keyless for public reads.
 */


const BASE = 'https://www.peeringdb.com/api';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_networks',
    description:
      'Look up networks in PeeringDB by name or ASN. Returns peering policy (Open/Selective/Restrictive), traffic level, info type (Content/NSP/ISP/Enterprise), scope, and IPv4/IPv6 prefix counts. Provide a name query or an ASN. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Network name (matches names containing this text).' },
        asn: { type: 'number', description: 'Autonomous System Number, e.g. 15169 for Google.' },
        limit: { type: 'number', description: 'Max results (default 20, max 100).' },
      },
    },
  },
  {
    name: 'search_exchanges',
    description:
      'Find internet exchanges (IXes) in PeeringDB by name, city, or country (2-letter code). Returns the IX name, location, continent region, member network count, and website. Provide at least one of query/city/country. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'IX name (matches names containing this text).' },
        city: { type: 'string', description: 'City name.' },
        country: { type: 'string', description: '2-letter ISO country code, e.g. US, DE, GB.' },
        limit: { type: 'number', description: 'Max results (default 20).' },
      },
    },
  },
  {
    name: 'search_facilities',
    description:
      'Find colocation facilities (data centers) in PeeringDB by name, city, or country (2-letter code). Returns the facility name, location, network count, street address, and website. Provide at least one of query/city/country. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Facility name (matches names containing this text).' },
        city: { type: 'string', description: 'City name.' },
        country: { type: 'string', description: '2-letter ISO country code, e.g. US, DE, GB.' },
        limit: { type: 'number', description: 'Max results (default 20).' },
      },
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_networks':
        return await searchNetworks(args);
      case 'search_exchanges':
        return await searchExchanges(args);
      case 'search_facilities':
        return await searchFacilities(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function searchNetworks(args: Record<string, unknown>): Promise<unknown> {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  const asn = typeof args.asn === 'number' ? args.asn : undefined;
  if (!query && asn === undefined) return { error: 'provide query (name) or asn' };
  const limit = clampLimit(args.limit, 20, 100);

  const filters: string[] = [];
  if (asn !== undefined) filters.push(`asn=${encodeURIComponent(String(asn))}`);
  else filters.push(`name__contains=${encodeURIComponent(query)}`);
  filters.push(`limit=${limit}`, 'depth=0');

  const rows = await pdbGet(`/net?${filters.join('&')}`);
  if (!Array.isArray(rows)) return rows;
  const networks = rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    asn: r.asn,
    type: r.info_type,
    traffic: r.info_traffic,
    scope: r.info_scope,
    policy: r.policy_general,
    website: r.website,
    ipv4_prefixes: r.info_prefixes4,
    ipv6_prefixes: r.info_prefixes6,
  }));
  return { count: networks.length, networks };
}

async function searchExchanges(args: Record<string, unknown>): Promise<unknown> {
  const filters = buildLocationFilters(args);
  if (typeof filters === 'object' && 'error' in filters) return filters;
  const limit = clampLimit(args.limit, 20, 100);

  const rows = await pdbGet(`/ix?${filters.join('&')}&limit=${limit}`);
  if (!Array.isArray(rows)) return rows;
  const exchanges = rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    full_name: r.name_long,
    city: r.city,
    country: r.country,
    region: r.region_continent,
    networks: r.net_count,
    website: r.website,
  }));
  return { count: exchanges.length, exchanges };
}

async function searchFacilities(args: Record<string, unknown>): Promise<unknown> {
  const filters = buildLocationFilters(args);
  if (typeof filters === 'object' && 'error' in filters) return filters;
  const limit = clampLimit(args.limit, 20, 100);

  const rows = await pdbGet(`/fac?${filters.join('&')}&limit=${limit}`);
  if (!Array.isArray(rows)) return rows;
  const facilities = rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    country: r.country,
    networks: r.net_count,
    address: r.address1,
    website: r.website,
  }));
  return { count: facilities.length, facilities };
}

function buildLocationFilters(args: Record<string, unknown>): string[] | { error: string } {
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  const city = typeof args.city === 'string' ? args.city.trim() : '';
  const country = typeof args.country === 'string' ? args.country.trim() : '';
  const filters: string[] = [];
  if (query) filters.push(`name__contains=${encodeURIComponent(query)}`);
  if (city) filters.push(`city=${encodeURIComponent(city)}`);
  if (country) filters.push(`country=${encodeURIComponent(country)}`);
  if (filters.length === 0) return { error: 'provide query, city, or country' };
  return filters;
}

function clampLimit(raw: unknown, def: number, max: number): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : def;
  return Math.min(Math.max(1, n), max);
}

async function pdbGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (res.status === 429) return { error: 'PeeringDB rate limit (anonymous); try again shortly' };
  if (!res.ok) {
    const body = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    return { error: `PeeringDB: ${res.status} ${body}` };
  }
  const json = (await res.json()) as { data?: unknown };
  return Array.isArray(json?.data) ? json.data : json;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
