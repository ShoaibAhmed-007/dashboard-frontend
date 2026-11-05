import { api } from "@/lib/api";

export interface GeneratedImage {
  blob: Blob;
  mimeType: string;
  fileName: string;
  /** The image model actually used — follows the caller's workspace AI tier. */
  model: string;
  /** Null when the rate for `model` is unmeasured, distinct from a free 0.00. */
  estimatedCostUsd: number | null;
}

function base64ToBlob(b64: string, mimeType: string): Blob {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

export const imageGenerationService = {
  async generate(prompt: string, signal?: AbortSignal): Promise<GeneratedImage> {
    const { data } = await api.post<{
      data: { b64Json: string; mimeType: string; model: string; estimatedCostUsd: number | null };
    }>("/ai-generation/image", { prompt }, { signal });

    const { b64Json, mimeType, model, estimatedCostUsd } = data.data;
    const ext = mimeType.split("/")[1] ?? "png";
    return {
      blob: base64ToBlob(b64Json, mimeType),
      mimeType,
      fileName: `generated-image-${Date.now()}.${ext}`,
      model,
      estimatedCostUsd,
    };
  },
};
