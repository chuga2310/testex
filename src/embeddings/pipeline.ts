import { existsSync } from "fs";
import { join } from "path";
import { config } from "../config.js";

type FeatureExtractionPipeline = (
  input: string | string[],
  opts: Record<string, unknown>
) => Promise<{ data: Float32Array; dims: number[] }>;

let _extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(modelName: string): Promise<FeatureExtractionPipeline> {
  if (_extractor) return _extractor;

  const { pipeline, env } = await import("@xenova/transformers");

  // Always load from local models/ directory — never call HuggingFace Hub
  env.cacheDir = config.modelsDir;
  env.allowRemoteModels = false;
  env.allowLocalModels = true;

  const onnxPath = join(config.modelsDir, modelName, "onnx", "model_quantized.onnx");
  if (!existsSync(onnxPath)) {
    throw new Error(
      `Model not found at ${onnxPath}\n` +
        `Run: npm run download-model`
    );
  }

  process.stderr.write("  Loading ONNX model into memory...");
  _extractor = (await pipeline(
    "feature-extraction",
    modelName
  )) as unknown as FeatureExtractionPipeline;
  process.stderr.write("\r  ONNX model ready.              \n");

  return _extractor;
}

export class EmbeddingPipeline {
  constructor(private readonly modelName: string = config.embeddingModel) {}

  async embed(texts: string[]): Promise<number[][]> {
    const extractor = await getExtractor(this.modelName);
    const BATCH = 32;
    const result: number[][] = [];
    const dim = config.embeddingDim;

    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH);
      const output = await extractor(batch, { pooling: "mean", normalize: true });
      for (let j = 0; j < batch.length; j++) {
        result.push(
          Array.from(output.data.slice(j * dim, (j + 1) * dim) as Float32Array)
        );
      }
      // Progress for large projects
      if (texts.length > BATCH) {
        const done = Math.min(i + BATCH, texts.length);
        process.stdout.write(
          `\rEmbedding... ${done}/${texts.length} components`
        );
      }
    }

    if (texts.length > BATCH) {
      process.stdout.write("\r");
    }

    return result;
  }

  async embedOne(text: string): Promise<number[]> {
    const [vec] = await this.embed([text]);
    return vec;
  }

  /** Embed multiple independent texts (e.g. separate keywords for union search). */
  async embedBatch(texts: string[]): Promise<number[][]> {
    return this.embed(texts);
  }
}
