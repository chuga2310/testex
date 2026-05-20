#!/usr/bin/env node
/**
 * Downloads the ONNX embedding model into ./models/
 * Runs automatically via postinstall. Safe to re-run (skips if already done).
 */
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, "..", "models");
const MODEL_NAME = "Xenova/bge-small-en-v1.5";
const MODEL_FILE = join(MODELS_DIR, "Xenova", "bge-small-en-v1.5", "onnx", "model_quantized.onnx");

if (existsSync(MODEL_FILE)) {
  console.log("testex: embedding model already present, skipping download.");
  process.exit(0);
}

console.log("testex: downloading embedding model (Xenova/bge-small-en-v1.5, ~23 MB)...");
console.log("  This is the only step that requires internet.");
console.log("  After this, testex runs 100% offline.");

try {
  const { pipeline, env } = await import("@xenova/transformers");
  env.cacheDir = MODELS_DIR;
  await pipeline("feature-extraction", MODEL_NAME);
  console.log(`testex: model cached to ${MODELS_DIR}`);
} catch (err) {
  console.warn(`testex: model download failed (${err.message}).`);
  console.warn("  Run \"npm run download-model\" manually when online.");
}
