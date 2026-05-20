import { resolve, join } from "path";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { config } from "../config.js";
import { scanDirectory } from "../parser/react-parser.js";
import { normalize } from "../parser/normalizer.js";
import { EmbeddingPipeline } from "../embeddings/pipeline.js";
import { LanceDBStore } from "../vectorstore/lancedb-store.js";
import { toEmbedText } from "../schema/models.js";

function store(): LanceDBStore {
  return new LanceDBStore(config.dbPath);
}
function pipeline(): EmbeddingPipeline {
  return new EmbeddingPipeline(config.embeddingModel);
}

// ── index ────────────────────────────────────────────────────────────────────
export async function cmdIndex(
  path: string,
  opts: { reset?: boolean }
): Promise<void> {
  const root = resolve(path);
  if (!existsSync(root)) {
    console.error(`Path not found: ${root}`);
    process.exit(1);
  }

  const db = store();
  if (opts.reset) {
    await db.drop();
    console.log("Existing index dropped.");
  }

  process.stdout.write("Scanning files...");
  let records = scanDirectory(
    root,
    config.indexExtensions,
    config.excludeDirs,
    config.dataTestAttrs
  );
  records = normalize(records);
  process.stdout.write(`\r✓ Found ${records.length} components\n`);

  if (!records.length) {
    console.log("No components found.");
    return;
  }

  process.stdout.write("Embedding (first run loads model ~5s)...\n");
  const pl = pipeline();
  const texts = records.map(toEmbedText);

  let vectors: number[][];
  try {
    vectors = await pl.embed(texts);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\nEmbedding failed: ${msg}`);
    process.exit(1);
  }

  process.stdout.write("\r✓ Embeddings ready                       \n");

  process.stdout.write("Storing...");
  const count = await db.upsert(records, vectors);
  process.stdout.write(`\r✓ Stored ${count} records\n`);

  const allIds = records.flatMap((r) => r.dataTestIds);
  console.log(`\n✓ Indexed ${count} components, ${allIds.length} test IDs`);
  console.log(`  DB: ${config.dbPath}`);
}

// ── search ───────────────────────────────────────────────────────────────────
/**
 * Search modes:
 *  default            – semantic vector search (single or space-joined keywords)
 *  --union kw1 kw2    – embed each keyword separately, merge best scores
 *  --must  kw1 kw2    – AND filter: components that contain ALL test IDs
 *  --test-ids         – exact substring match on data-test attribute values
 */
export async function cmdSearch(
  query: string,
  opts: {
    limit?: number;
    testIds?: boolean;
    must?: string[];   // AND filter keywords
    union?: string[];  // per-keyword union
  }
): Promise<void> {
  const limit = opts.limit ?? config.searchLimit;
  const db = store();

  // ── mode: --must (AND filter on test IDs) ──────────────────────────────────
  if (opts.must?.length) {
    const keywords = [query, ...(opts.must ?? [])].filter(Boolean);
    const results = await db.searchByAllTestIds(keywords);
    if (!results.length) {
      console.log(`No components contain ALL of: ${keywords.join(", ")}`);
      return;
    }
    console.log(`\nAND filter — must contain: ${keywords.join(", ")}\n`);
    for (const r of results.slice(0, limit)) {
      console.log(`  ${r.name.padEnd(24)} ${r.dataTestIds.join(", ")}`);
      console.log(`  ${"".padEnd(24)} ${r.file}`);
    }
    return;
  }

  // ── mode: --test-ids (exact substring match) ───────────────────────────────
  if (opts.testIds) {
    const results = await db.searchByTestId(query);
    if (!results.length) {
      console.log("No results.");
      return;
    }
    console.log(`\nTest ID search: "${query}"\n`);
    for (const r of results.slice(0, limit)) {
      console.log(`  ${r.name.padEnd(24)} ${r.dataTestIds.join(", ")}`);
      console.log(`  ${"".padEnd(24)} ${r.file}`);
    }
    return;
  }

  // ── mode: --union (per-keyword vectors, merge best scores) ────────────────
  const pl = pipeline();
  if (opts.union?.length) {
    const keywords = [query, ...(opts.union ?? [])].filter(Boolean);
    const vecs = await pl.embedBatch(keywords);
    const results = await db.searchMulti(vecs, limit);
    if (!results.length) {
      console.log('No results. Run "testex index <path>" first.');
      return;
    }
    printSearchTable(`Union search: ${keywords.join(" | ")}`, results);
    return;
  }

  // ── mode: default semantic search ─────────────────────────────────────────
  const vec = await pl.embedOne(query);
  const results = await db.search(vec, limit);
  if (!results.length) {
    console.log('No results. Run "testex index <path>" first.');
    return;
  }
  printSearchTable(`Search: "${query}"`, results);
}

function printSearchTable(
  title: string,
  results: { record: { name: string; route: string | null; dataTestIds: string[] }; score: number }[]
): void {
  const COL = [4, 24, 16, 32, 8, 7];
  const header = [
    "#".padEnd(COL[0]),
    "Component".padEnd(COL[1]),
    "Route".padEnd(COL[2]),
    "Test IDs".padEnd(COL[3]),
    "Conf.".padEnd(COL[4]),
    "Score".padEnd(COL[5]),
  ].join("  ");
  console.log(`\n${title}\n`);
  console.log(header);
  console.log("─".repeat(header.length));
  const CONF_ICON: Record<string, string> = { high: "●", medium: "◑", low: "○" };
  results.forEach((r, i) => {
    const conf = "confidence" in r ? (r as { confidence: string }).confidence : "medium";
    console.log(
      [
        String(i + 1).padEnd(COL[0]),
        r.record.name.slice(0, COL[1]).padEnd(COL[1]),
        (r.record.route ?? "-").slice(0, COL[2]).padEnd(COL[2]),
        r.record.dataTestIds.slice(0, 3).join(", ").slice(0, COL[3]).padEnd(COL[3]),
        `${CONF_ICON[conf] ?? "○"} ${conf}`.padEnd(COL[4]),
        r.score.toFixed(3).padEnd(COL[5]),
      ].join("  ")
    );
  });
}

// ── test-context ─────────────────────────────────────────────────────────────
export async function cmdTestContext(component: string): Promise<void> {
  const vec = await pipeline().embedOne(component);
  const results = await store().search(vec, 3);
  if (!results.length) {
    console.log('No components found. Run "testex index <path>" first.');
    return;
  }

  console.log(`\nPlaywright Test Context: ${component}\n`);
  for (const { record: r } of results) {
    console.log(`Component : ${r.name}`);
    console.log(`File      : ${r.file}`);
    if (r.route) console.log(`Route     : ${r.route}`);
    if (r.dataTestIds.length) {
      console.log("\nLocators:");
      for (const id of r.dataTestIds) {
        console.log(`  page.getByTestId('${id}')`);
        console.log(`  page.locator('[data-test="${id}"]')`)
      }
    }
    if (r.userActions.length)
      console.log(`\nActions   : ${r.userActions.join(", ")}`);
    console.log();
  }
}

// ── stats ────────────────────────────────────────────────────────────────────
export async function cmdStats(): Promise<void> {
  const db = store();
  const count = await db.count();
  const ids = await db.allTestIds();
  console.log("\ntestex Index Stats");
  console.log("──────────────────────────────");
  console.log(`Total components : ${count}`);
  console.log(`Total test IDs   : ${ids.length}`);
  console.log(`DB path          : ${config.dbPath}`);
  console.log(`Embedding model  : ${config.embeddingModel}`);
  if (ids.length) {
    console.log("\nSample test IDs:");
    ids.slice(0, 10).forEach((id) => console.log(`  ${id}`));
  }
}

// ── watch ────────────────────────────────────────────────────────────────────
export async function cmdWatch(path: string): Promise<void> {
  const { default: chokidar } = await import("chokidar");
  const extSet = new Set(config.indexExtensions);
  const db = store();
  const pl = pipeline();

  const watcher = chokidar.watch(path, {
    ignored: (p: string) =>
      config.excludeDirs.some((d) => p.includes(`/${d}/`)),
    persistent: true,
    ignoreInitial: true,
  });

  console.log(`Watching ${path} for changes... (Ctrl+C to stop)`);

  watcher.on("change", async (filePath: string) => {
    const ext = filePath.slice(filePath.lastIndexOf("."));
    if (!extSet.has(ext)) return;
    console.log(`Re-indexing: ${filePath}`);
    const { parseFile } = await import("../parser/react-parser.js");
    const { toEmbedText } = await import("../schema/models.js");
    const records = parseFile(filePath, config.dataTestAttrs);
    if (!records.length) return;
    const vectors = await pl.embed(records.map(toEmbedText));
    await db.upsert(records, vectors);
    console.log(`✓ Updated ${records.length} component(s)`);
  });
}

// ── init ─────────────────────────────────────────────────────────────────────
export async function cmdInit(opts: { src?: string; force?: boolean }): Promise<void> {
  const cwd = process.cwd();
  const vscodeDir = join(cwd, ".vscode");
  const mcpJsonPath = join(vscodeDir, "mcp.json");

  // ── create .vscode/mcp.json ──────────────────────────────────────────────
  if (!existsSync(vscodeDir)) {
    mkdirSync(vscodeDir, { recursive: true });
  }

  if (existsSync(mcpJsonPath) && !opts.force) {
    console.log(`ℹ  .vscode/mcp.json already exists. Use --force to overwrite.`);
  } else {
    const mcpConfig = {
      servers: {
        testex: {
          type: "stdio",
          command: "testex",
          args: ["mcp"],
          description: "Local AI index for data-test IDs and UI components",
        },
      },
    };
    writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + "\n");
    console.log(`✓ Created .vscode/mcp.json`);
  }

  // ── optionally index source ──────────────────────────────────────────────
  const srcPath = opts.src ?? autoDetectSrc(cwd);
  if (srcPath) {
    console.log(`\nIndexing ${srcPath}...`);
    await cmdIndex(srcPath, {});
  } else {
    console.log(`\nNext step — index your source code:`);
    console.log(`  testex index ./src`);
  }

  // ── print next steps ─────────────────────────────────────────────────────
  console.log(`\n─────────────────────────────────────────`);
  console.log(`✓ testex is ready for GitHub Copilot`);
  console.log(`\n  1. Open .vscode/mcp.json in VS Code`);
  console.log(`  2. Click the "Start" button that appears`);
  console.log(`  3. Open Copilot Chat → Agent mode`);
  console.log(`\nExample prompts:`);
  console.log(`  "What test IDs are on the login page?"`);
  console.log(`  "Generate a Playwright test for CheckoutPage"`);
}

function autoDetectSrc(cwd: string): string | null {
  for (const candidate of ["src", "app", "pages", "components"]) {
    if (existsSync(join(cwd, candidate))) return candidate;
  }
  return null;
}
