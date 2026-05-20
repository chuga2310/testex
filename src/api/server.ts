import Fastify from "fastify";
import { config } from "../config.js";
import { EmbeddingPipeline } from "../embeddings/pipeline.js";
import { LanceDBStore } from "../vectorstore/lancedb-store.js";

export async function startApiServer(
  host = config.apiHost,
  port = config.apiPort
): Promise<void> {
  const app = Fastify({ logger: false });
  const store = new LanceDBStore(config.dbPath);
  const pipeline = new EmbeddingPipeline(config.embeddingModel);

  app.get("/health", async () => ({ status: "ok", db: config.dbPath }));

  app.get("/stats", async () => {
    const count = await store.count();
    const ids = await store.allTestIds();
    return {
      total_components: count,
      total_test_ids: ids.length,
      embedding_model: config.embeddingModel,
    };
  });

  app.get<{ Querystring: { q: string; limit?: string } }>(
    "/search/components",
    async (req) => {
      const { q, limit = "10" } = req.query;
      const vec = await pipeline.embedOne(q);
      const results = await store.search(vec, parseInt(limit, 10));
      return {
        query: q,
        results: results.map((r) => ({
          name: r.record.name,
          file: r.record.file,
          route: r.record.route,
          test_ids: r.record.dataTestIds,
          score: Math.round(r.score * 10000) / 10000,
        })),
      };
    }
  );

  app.get<{ Querystring: { q: string; limit?: string } }>(
    "/search/test-ids",
    async (req) => {
      const { q, limit = "20" } = req.query;
      const exact = await store.searchByTestId(q);
      if (exact.length) {
        return {
          query: q,
          results: exact
            .slice(0, parseInt(limit, 10))
            .map((r) => ({ component: r.name, test_ids: r.dataTestIds, file: r.file })),
        };
      }
      const vec = await pipeline.embedOne(q);
      const results = await store.search(vec, parseInt(limit, 10));
      return {
        query: q,
        results: results.map((r) => ({
          component: r.record.name,
          test_ids: r.record.dataTestIds,
          file: r.record.file,
        })),
      };
    }
  );

  app.get<{ Params: { page: string } }>("/flow/:page", async (req) => {
    const route = req.params.page.startsWith("/")
      ? req.params.page
      : `/${req.params.page}`;
    const records = await store.getByRoute(route);
    return {
      page: req.params.page,
      components: records.map((r) => ({ name: r.name, test_ids: r.dataTestIds })),
    };
  });

  app.get("/test-ids", async () => {
    return { test_ids: await store.allTestIds() };
  });

  await app.listen({ host, port });
  console.log(`testex API running at http://${host}:${port}`);
  console.log(`Swagger docs: http://${host}:${port}/documentation`);
}
