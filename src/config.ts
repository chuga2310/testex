import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseList(val: string | undefined, defaults: string[]): string[] {
  if (!val) return defaults;
  try {
    return JSON.parse(val) as string[];
  } catch {
    return defaults;
  }
}

export const config = {
  dbPath: process.env.TESTEX_DB_PATH ?? ".testex/db",
  embeddingModel:
    process.env.TESTEX_EMBEDDING_MODEL ?? "Xenova/bge-small-en-v1.5",
  embeddingDim: parseInt(process.env.TESTEX_EMBEDDING_DIM ?? "384", 10),
  indexExtensions: parseList(process.env.TESTEX_INDEX_EXTENSIONS, [
    ".tsx",
    ".jsx",
    ".ts",
    ".js",
    ".vue",
    ".svelte",
  ]),
  excludeDirs: parseList(process.env.TESTEX_EXCLUDE_DIRS, [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "coverage",
  ]),
  dataTestAttrs: parseList(process.env.TESTEX_DATA_TEST_ATTRS, [
    "data-test",
    "data-testid",
    "data-cy",
    "data-e2e",
  ]),
  apiHost: process.env.TESTEX_API_HOST ?? "0.0.0.0",
  apiPort: parseInt(process.env.TESTEX_API_PORT ?? "8000", 10),
  searchLimit: parseInt(process.env.TESTEX_SEARCH_LIMIT ?? "10", 10),
  modelsDir:
    process.env.TESTEX_MODELS_DIR ??
    join(__dirname, "..", "models"),
} as const;
