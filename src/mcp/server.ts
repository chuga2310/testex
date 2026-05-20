import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "../config.js";
import { EmbeddingPipeline } from "../embeddings/pipeline.js";
import { LanceDBStore } from "../vectorstore/lancedb-store.js";

let _store: LanceDBStore | null = null;
let _pipeline: EmbeddingPipeline | null = null;

function store(): LanceDBStore {
  _store ??= new LanceDBStore(config.dbPath);
  return _store;
}
function pipeline(): EmbeddingPipeline {
  _pipeline ??= new EmbeddingPipeline(config.embeddingModel);
  return _pipeline;
}

/** Wrap any tool handler so unhandled errors return a clean MCP error text
 *  instead of crashing the entire server process. */
function safe<T extends object>(
  fn: (args: T) => Promise<{ content: { type: "text"; text: string }[] }>
): (args: T) => Promise<{ content: { type: "text"; text: string }[] }> {
  return async (args: T) => {
    try {
      return await fn(args);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: JSON.stringify({ error: message }) }],
      };
    }
  };
}

/** Clamp L2-distance-based score to a [0, 1] similarity value. */
function toSimilarity(distance: number): number {
  return Math.round(Math.max(0, Math.min(1, 1 - distance)) * 10000) / 10000;
}

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: "testex",
    version: "0.1.0",
  });

  // ── search_components ────────────────────────────────────────────────────
  server.tool(
    "search_components",
    "Find UI components by natural language description",
    { query: z.string(), limit: z.number().optional() },
    safe(async ({ query, limit = 10 }) => {
      const vec = await pipeline().embedOne(query);
      const results = await store().search(vec, limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              results.map((r) => ({
                name: r.record.name,
                file: r.record.file,
                route: r.record.route,
                data_test_ids: r.record.dataTestIds,
                user_actions: r.record.userActions,
                score: Math.round(r.score * 10000) / 10000,
              }))
            ),
          },
        ],
      };
    })
  );

  // ── search_test_ids ───────────────────────────────────────────────────────
  server.tool(
    "search_test_ids",
    "Find data-test IDs by keyword or semantic query. Use exact=true for substring match.",
    { query: z.string(), limit: z.number().optional(), exact: z.boolean().optional() },
    safe(async ({ query, limit = 20, exact = false }) => {
      if (exact) {
        const records = await store().searchByTestId(query);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                records.slice(0, limit).map((r) => ({
                  component: r.name,
                  file: r.file,
                  test_ids: r.dataTestIds,
                  match_type: "exact",
                }))
              ),
            },
          ],
        };
      }
      // Try exact first, fall back to semantic
      const exact_records = await store().searchByTestId(query);
      if (exact_records.length) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                exact_records.slice(0, limit).map((r) => ({
                  component: r.name,
                  file: r.file,
                  test_ids: r.dataTestIds,
                  match_type: "exact",
                }))
              ),
            },
          ],
        };
      }
      const vec = await pipeline().embedOne(query);
      const results = await store().search(vec, limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              results
                .filter((r) => r.record.dataTestIds.length)
                .map((r) => ({
                  component: r.record.name,
                  file: r.record.file,
                  test_ids: r.record.dataTestIds,
                  match_type: "semantic",
                  score: Math.round(r.score * 10000) / 10000,
                }))
            ),
          },
        ],
      };
    })
  );

  // ── search_multi ──────────────────────────────────────────────────────────
  server.tool(
    "search_multi",
    "Union search: embed each keyword separately and merge best-score results. Use when keywords are unrelated (e.g. login + checkout).",
    { keywords: z.array(z.string()).min(2), limit: z.number().optional() },
    safe(async ({ keywords, limit = 10 }) => {
      const vecs = await pipeline().embedBatch(keywords);
      const results = await store().searchMulti(vecs, limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              results.map((r) => ({
                name: r.record.name,
                file: r.record.file,
                route: r.record.route,
                data_test_ids: r.record.dataTestIds,
                score: Math.round(r.score * 10000) / 10000,
              }))
            ),
          },
        ],
      };
    })
  );

  // ── search_must ───────────────────────────────────────────────────────────
  server.tool(
    "search_must",
    "AND filter: return only components that contain ALL of the specified test IDs.",
    { test_ids: z.array(z.string()).min(1), limit: z.number().optional() },
    safe(async ({ test_ids, limit = 10 }) => {
      const records = await store().searchByAllTestIds(test_ids);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              records.slice(0, limit).map((r) => ({
                name: r.name,
                file: r.file,
                route: r.route,
                data_test_ids: r.dataTestIds,
              }))
            ),
          },
        ],
      };
    })
  );

  // ── get_user_flow ─────────────────────────────────────────────────────────
  server.tool(
    "get_user_flow",
    "Get all components and test IDs for a page or route",
    { page: z.string() },
    safe(async ({ page }) => {
      const route = page.startsWith("/") ? page : `/${page}`;
      let records = await store().getByRoute(route);
      if (!records.length) {
        const vec = await pipeline().embedOne(page);
        const results = await store().search(vec, 5);
        records = results.filter((r) => r.record.route).map((r) => r.record);
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              page,
              components: records.map((r) => ({
                name: r.name,
                route: r.route,
                test_ids: r.dataTestIds,
                actions: r.userActions,
              })),
            }),
          },
        ],
      };
    })
  );

  // ── generate_test_context ─────────────────────────────────────────────────
  server.tool(
    "generate_test_context",
    "Generate Playwright locators for a component",
    { component: z.string() },
    safe(async ({ component }) => {
      const vec = await pipeline().embedOne(component);
      const results = await store().search(vec, 3);
      if (!results.length) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: 'No components found. Run "testex index <path>" first.',
              }),
            },
          ],
        };
      }
      const contexts = results.map(({ record: r }) => {
        const locators: string[] = [];
        for (const id of r.dataTestIds) {
          locators.push(`page.getByTestId("${id}")`);
          locators.push(`page.locator('[data-testid="${id}"]')`);
        }
        for (const label of r.ariaLabels) {
          locators.push(`page.getByRole("*", { name: "${label}" })`);
        }
        return {
          component: r.name,
          file: r.file,
          route: r.route,
          locators,
          suggested_actions: r.userActions,
        };
      });
      return {
        content: [
          { type: "text", text: JSON.stringify({ component, contexts }) },
        ],
      };
    })
  );

  // ── find_similar_components ───────────────────────────────────────────────
  server.tool(
    "find_similar_components",
    "Find semantically similar components",
    { component: z.string(), limit: z.number().optional() },
    safe(async ({ component, limit = 5 }) => {
      const vec = await pipeline().embedOne(component);
      const results = await store().search(vec, limit + 1);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              results
                .filter(
                  (r) => r.record.name.toLowerCase() !== component.toLowerCase()
                )
                .slice(0, limit)
                .map((r) => ({
                  name: r.record.name,
                  file: r.record.file,
                  test_ids: r.record.dataTestIds,
                  similarity: toSimilarity(r.score),
                }))
            ),
          },
        ],
      };
    })
  );

  // ── explain_page_structure ────────────────────────────────────────────────
  server.tool(
    "explain_page_structure",
    "Analyze the UI structure and test coverage of a route",
    { route: z.string() },
    safe(async ({ route }) => {
      let records = await store().getByRoute(route);
      if (!records.length) {
        const vec = await pipeline().embedOne(route);
        const results = await store().search(vec, 5);
        records = results.map((r) => r.record);
      }
      const allTestIds = records.flatMap((r) => r.dataTestIds);
      const allActions = [...new Set(records.flatMap((r) => r.userActions))];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              route,
              components: records.map((r) => r.name),
              total_test_ids: allTestIds.length,
              test_ids: allTestIds,
              available_actions: allActions,
              files: records.map((r) => r.file),
              test_coverage:
                allTestIds.length > 3 ? "good" : "needs_improvement",
            }),
          },
        ],
      };
    })
  );

  // ── list_all_test_ids ─────────────────────────────────────────────────────
  server.tool(
    "list_all_test_ids",
    "List indexed data-test IDs. Returns up to `limit` IDs (default 200). Use `offset` for pagination.",
    { limit: z.number().optional(), offset: z.number().optional() },
    safe(async ({ limit = 200, offset = 0 }) => {
      const ids = await store().allTestIds();
      const page = ids.slice(offset, offset + limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total: ids.length,
              offset,
              limit,
              ids: page,
            }),
          },
        ],
      };
    })
  );

  // ── index_stats ───────────────────────────────────────────────────────────
  server.tool(
    "index_stats",
    "Return index statistics",
    {},
    safe(async () => {
      const count = await store().count();
      const ids = await store().allTestIds();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              total_components: count,
              total_test_ids: ids.length,
              db_path: config.dbPath,
              embedding_model: config.embeddingModel,
            }),
          },
        ],
      };
    })
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
