#!/usr/bin/env node
import { program } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read version from package.json
let version = "0.1.0";
try {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8")
  ) as { version: string };
  version = pkg.version;
} catch {}

program
  .name("testex")
  .description(
    "Local AI indexing for data-test IDs and React UI components."
  )
  .version(version);

program
  .command("index [path]")
  .description("Scan and index React/JSX/TSX files in PATH")
  .option("-r, --reset", "Drop existing index before indexing")
  .action(async (path = ".", opts: { reset?: boolean }) => {
    const { cmdIndex } = await import("./commands.js");
    await cmdIndex(path, opts);
  });

program
  .command("search <query>")
  .description("Semantic search over indexed components")
  .option("-n, --limit <n>", "Number of results", "10")
  .option("-t, --test-ids", "Search test IDs by substring only")
  .option("-u, --union <keywords...>", "Extra keywords (embed each separately, merge best scores)")
  .option("-m, --must <ids...>", "AND filter: only components containing ALL these test IDs")
  .action(async (
    query: string,
    opts: { limit?: string; testIds?: boolean; union?: string[]; must?: string[] }
  ) => {
    const { cmdSearch } = await import("./commands.js");
    await cmdSearch(query, {
      limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
      testIds: opts.testIds,
      union: opts.union,
      must: opts.must,
    });
  });

program
  .command("test-context <component>")
  .description("Generate Playwright test context for a component")
  .action(async (component: string) => {
    const { cmdTestContext } = await import("./commands.js");
    await cmdTestContext(component);
  });

program
  .command("stats")
  .description("Show index statistics")
  .action(async () => {
    const { cmdStats } = await import("./commands.js");
    await cmdStats();
  });

program
  .command("watch [path]")
  .description("Watch for file changes and incrementally re-index")
  .action(async (path = ".") => {
    const { cmdWatch } = await import("./commands.js");
    await cmdWatch(path);
  });

program
  .command("serve")
  .description("Start the REST API server")
  .option("--host <host>", "API host", "0.0.0.0")
  .option("--port <port>", "API port", "8000")
  .action(async (opts: { host?: string; port?: string }) => {
    const { startApiServer } = await import("../api/server.js");
    await startApiServer(opts.host, opts.port ? parseInt(opts.port, 10) : undefined);
  });

program
  .command("mcp")
  .description("Start the MCP server (stdio transport)")
  .action(async () => {
    const { startMcpServer } = await import("../mcp/server.js");
    await startMcpServer();
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
