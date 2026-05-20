import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "../config.js";
import { EmbeddingPipeline } from "../embeddings/pipeline.js";
import { LanceDBStore } from "../vectorstore/lancedb-store.js";
import {
  deriveTestFlow,
  generatePlaywrightSnippet,
  type ComponentRecord,
} from "../schema/models.js";

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

function safe<T extends object>(
  fn: (args: T) => Promise<{ content: { type: "text"; text: string }[] }>
): (args: T) => Promise<{ content: { type: "text"; text: string }[] }> {
  return async (args: T) => {
    try {
      return await fn(args);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text", text: JSON.stringify({ error: message }) }] };
    }
  };
}

function clampSimilarity(distance: number): number {
  return Math.round(Math.max(0, Math.min(1, 1 - distance)) * 10000) / 10000;
}

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({ name: "testex", version: "0.1.0" });

  // ── search_components ────────────────────────────────────────────────────
  server.tool(
    "search_components",
    "Find UI components by natural language description",
    { query: z.string(), limit: z.number().optional() },
    safe(async ({ query, limit = 10 }) => {
      const vec     = await pipeline().embedOne(query);
      const results = await store().search(vec, limit);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results.map((r) => ({
            name:          r.record.name,
            file:          r.record.file,
            route:         r.record.route,
            data_test_ids: r.record.dataTestIds,
            user_actions:  r.record.userActions,
            confidence:    r.confidence,
            score:         Math.round(r.score * 10000) / 10000,
          }))),
        }],
      };
    })
  );

  // ── search_test_ids ───────────────────────────────────────────────────────
  server.tool(
    "search_test_ids",
    "Find data-test IDs by keyword or semantic query. Use exact=true for substring match.",
    { query: z.string(), limit: z.number().optional(), exact: z.boolean().optional() },
    safe(async ({ query, limit = 20, exact = false }) => {
      const exactRecords = await store().searchByTestId(query);
      if (exact || exactRecords.length) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify(exactRecords.slice(0, limit).map((r) => ({
              component:  r.name,
              file:       r.file,
              test_ids:   r.dataTestIds,
              match_type: "exact",
              confidence: "high",
            }))),
          }],
        };
      }
      const vec     = await pipeline().embedOne(query);
      const results = await store().search(vec, limit);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(
            results
              .filter((r) => r.record.dataTestIds.length)
              .map((r) => ({
                component:  r.record.name,
                file:       r.record.file,
                test_ids:   r.record.dataTestIds,
                match_type: "semantic",
                confidence: r.confidence,
                score:      Math.round(r.score * 10000) / 10000,
              }))
          ),
        }],
      };
    })
  );

  // ── search_multi ──────────────────────────────────────────────────────────
  server.tool(
    "search_multi",
    "Union search: embed each keyword separately and merge best-score results. Use when keywords are unrelated (e.g. login + checkout).",
    { keywords: z.array(z.string()).min(2), limit: z.number().optional() },
    safe(async ({ keywords, limit = 10 }) => {
      const vecs    = await pipeline().embedBatch(keywords);
      const results = await store().searchMulti(vecs, limit);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results.map((r) => ({
            name:          r.record.name,
            file:          r.record.file,
            route:         r.record.route,
            data_test_ids: r.record.dataTestIds,
            confidence:    r.confidence,
            score:         Math.round(r.score * 10000) / 10000,
          }))),
        }],
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
        content: [{
          type: "text",
          text: JSON.stringify(records.slice(0, limit).map((r) => ({
            name:          r.name,
            file:          r.file,
            route:         r.route,
            data_test_ids: r.dataTestIds,
          }))),
        }],
      };
    })
  );

  // ── list_pages ─────────────────────────────────────────────────────────────
  server.tool(
    "list_pages",
    "List all indexed pages and routes. Good starting point for agents exploring a project.",
    { limit: z.number().optional() },
    safe(async ({ limit = 50 }) => {
      const records = await store().listPages(limit);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(records.map((r) => ({
            name:           r.name,
            route:          r.route,
            file:           r.file,
            test_ids_count: r.dataTestIds.length,
            test_ids:       r.dataTestIds,
            frameworks:     r.framework,
          }))),
        }],
      };
    })
  );

  // ── find_by_action ────────────────────────────────────────────────────────
  server.tool(
    "find_by_action",
    "Find components by interaction type: click | submit | fill | check | navigate",
    {
      action: z.enum(["click", "submit", "fill", "check", "navigate"]),
      limit:  z.number().optional(),
    },
    safe(async ({ action, limit = 10 }) => {
      const records = await store().findByAction(action, limit);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(records.map((r) => ({
            name:          r.name,
            route:         r.route,
            file:          r.file,
            data_test_ids: r.dataTestIds,
            elements:      r.elements.filter((e) => {
              if (action === "click")    return e.tag === "button" || e.tag === "a";
              if (action === "submit")   return e.inputType === "submit" || (e.tag === "button" && !e.inputType);
              if (action === "fill")     return e.tag === "input" || e.tag === "textarea";
              if (action === "check")    return e.inputType === "checkbox" || e.inputType === "radio";
              return true;
            }),
          }))),
        }],
      };
    })
  );

  // ── get_test_plan ─────────────────────────────────────────────────────────
  server.tool(
    "get_test_plan",
    "ONE-SHOT: full test plan for a page — route, ordered test flow, all test IDs with element context, and a ready Playwright snippet.",
    { page: z.string() },
    safe(async ({ page }) => {
      const route = page.startsWith("/") ? page : `/${page}`;
      let records = await store().getByRoute(route);
      if (!records.length) {
        const vec     = await pipeline().embedOne(page);
        const results = await store().search(vec, 5);
        records = results
          .filter((r) => r.record.route || r.record.elements.length > 0)
          .map((r) => r.record);
      }
      if (!records.length) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: `No components found for "${page}". Run testex index first.` }),
          }],
        };
      }

      const primary     = records[0];
      const allElements = records.flatMap((r) => r.elements);
      const allTestIds  = [...new Set(records.flatMap((r) => r.dataTestIds))];
      const testFlow    = deriveTestFlow(allElements);
      const snippet     = generatePlaywrightSnippet({
        ...primary,
        elements: allElements,
        dataTestIds: allTestIds,
        route: primary.route ?? route,
      } as ComponentRecord);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            page,
            route:              primary.route ?? route,
            components:         records.map((r) => r.name),
            files:              records.map((r) => r.file),
            all_test_ids:       allTestIds,
            elements:           allElements,
            test_flow:          testFlow,
            playwright_snippet: snippet,
          }),
        }],
      };
    })
  );

  // ── generate_playwright_test ──────────────────────────────────────────────
  server.tool(
    "generate_playwright_test",
    "Generate a ready-to-run Playwright test file for a component or page.",
    { component: z.string(), route: z.string().optional() },
    safe(async ({ component, route: routeOverride }) => {
      const vec     = await pipeline().embedOne(component);
      const results = await store().search(vec, 3);
      if (!results.length) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: "No components found. Run testex index first." }),
          }],
        };
      }
      const record: ComponentRecord = {
        ...results[0].record,
        route: routeOverride ?? results[0].record.route,
      };
      const testFlow = deriveTestFlow(record.elements);
      const snippet  = generatePlaywrightSnippet(record);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            component:       record.name,
            file:            record.file,
            route:           record.route,
            confidence:      results[0].confidence,
            test_flow:       testFlow,
            playwright_test: snippet,
          }),
        }],
      };
    })
  );

  // ── get_user_flow ─────────────────────────────────────────────────────────
  server.tool(
    "get_user_flow",
    "Get all components and test IDs for a page or route",
    { page: z.string() },
    safe(async ({ page }) => {
      const route   = page.startsWith("/") ? page : `/${page}`;
      let records   = await store().getByRoute(route);
      if (!records.length) {
        const vec     = await pipeline().embedOne(page);
        const results = await store().search(vec, 5);
        records = results.filter((r) => r.record.route).map((r) => r.record);
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            page,
            components: records.map((r) => ({
              name:      r.name,
              route:     r.route,
              test_ids:  r.dataTestIds,
              actions:   r.userActions,
            })),
          }),
        }],
      };
    })
  );

  // ── generate_test_context ─────────────────────────────────────────────────
  server.tool(
    "generate_test_context",
    "Generate Playwright locators for a component",
    { component: z.string() },
    safe(async ({ component }) => {
      const vec     = await pipeline().embedOne(component);
      const results = await store().search(vec, 3);
      if (!results.length) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: 'No components found. Run "testex index <path>" first.' }),
          }],
        };
      }
      const contexts = results.map(({ record: r }) => {
        const locators: string[] = [];
        for (const el of r.elements) {
          locators.push(`page.getByTestId('${el.testId}')`);
          if (el.text && (el.tag === "button" || el.tag === "a"))
            locators.push(`page.getByRole('${el.tag}', { name: '${el.text}' })`);
          if (el.placeholder)
            locators.push(`page.getByPlaceholder('${el.placeholder}')`);
          if (el.ariaLabel)
            locators.push(`page.getByLabel('${el.ariaLabel}')`);
        }
        return {
          component:          r.name,
          file:               r.file,
          route:              r.route,
          confidence:         results[0].confidence,
          locators:           [...new Set(locators)],
          suggested_actions:  r.userActions,
          test_flow:          deriveTestFlow(r.elements),
        };
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ component, contexts }) }],
      };
    })
  );

  // ── find_similar_components ───────────────────────────────────────────────
  server.tool(
    "find_similar_components",
    "Find semantically similar components",
    { component: z.string(), limit: z.number().optional() },
    safe(async ({ component, limit = 5 }) => {
      const vec     = await pipeline().embedOne(component);
      const results = await store().search(vec, limit + 1);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(
            results
              .filter((r) => r.record.name.toLowerCase() !== component.toLowerCase())
              .slice(0, limit)
              .map((r) => ({
                name:       r.record.name,
                file:       r.record.file,
                test_ids:   r.record.dataTestIds,
                similarity: clampSimilarity(r.score),
                confidence: r.confidence,
              }))
          ),
        }],
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
        const vec     = await pipeline().embedOne(route);
        const results = await store().search(vec, 5);
        records = results.map((r) => r.record);
      }
      const allTestIds = records.flatMap((r) => r.dataTestIds);
      const allActions = [...new Set(records.flatMap((r) => r.userActions))];
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            route,
            components:       records.map((r) => r.name),
            total_test_ids:   allTestIds.length,
            test_ids:         allTestIds,
            available_actions: allActions,
            files:            records.map((r) => r.file),
            test_coverage:    allTestIds.length > 3 ? "good" : "needs_improvement",
          }),
        }],
      };
    })
  );

  // ── list_all_test_ids ─────────────────────────────────────────────────────
  server.tool(
    "list_all_test_ids",
    "List indexed data-test IDs. Returns up to `limit` IDs (default 200). Use `offset` for pagination.",
    { limit: z.number().optional(), offset: z.number().optional() },
    safe(async ({ limit = 200, offset = 0 }) => {
      const ids  = await store().allTestIds();
      const page = ids.slice(offset, offset + limit);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ total: ids.length, offset, limit, ids: page }),
        }],
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
      const ids   = await store().allTestIds();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total_components: count,
            total_test_ids:   ids.length,
            db_path:          config.dbPath,
            embedding_model:  config.embeddingModel,
          }),
        }],
      };
    })
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
