import { api } from "@/lib/api";
import type { ChatAttachment } from "@/services/chatAttachment.service";

export interface DocumentSection {
  heading?: string;
  body?: string;
  bullets?: string[];
}

export interface GeneratedDocumentContent {
  title: string;
  sections: DocumentSection[];
}

export interface GenerateDocumentPayload {
  conversationId: string;
  messageId?: string;
  title: string;
  fileName?: string;
  sections: DocumentSection[];
}

export interface PresentationTheme {
  accentColor: string;
  headFont: string;
  bodyFont: string;
}

// Discriminated union mirroring the backend's presentation slide schema
// (apps/api/src/document-generation/dto/generate-presentation.dto.ts).
export type PresentationSlide =
  | { type: "title"; heading: string; subheading?: string }
  | { type: "bullets"; heading: string; bullets: string[] }
  | {
      type: "image-left" | "image-right";
      heading: string;
      body?: string;
      bullets?: string[];
      imagePrompt: string;
    }
  | {
      type: "chart";
      heading: string;
      chartType: "bar" | "line" | "pie" | "doughnut";
      labels: string[];
      values: number[];
    }
  | { type: "quote"; quote: string; attribution?: string }
  | { type: "section-divider"; heading: string };

export interface GeneratedPresentationContent {
  title: string;
  subtitle?: string;
  theme: PresentationTheme;
  slides: PresentationSlide[];
}

export interface GeneratePresentationPayload {
  conversationId: string;
  messageId?: string;
  title: string;
  subtitle?: string;
  fileName?: string;
  theme: PresentationTheme;
  slides: PresentationSlide[];
}

export const documentGenerationService = {
  // Step 1: ask the backend to turn a free-text prompt into structured content.
  // The drafting model follows the caller's workspace AI tier. `format` picks
  // which shape comes back: the flat {title, sections} shape for PDF, or the
  // themed {theme, slides} shape for a presentation.
  async draftContent(prompt: string, signal?: AbortSignal): Promise<GeneratedDocumentContent> {
    const { data } = await api.post<{ data: GeneratedDocumentContent }>(
      "/ai-generation/document-draft",
      { prompt, format: "pdf" },
      { signal }
    );
    return data.data;
  },

  async draftPresentation(
    prompt: string,
    signal?: AbortSignal
  ): Promise<GeneratedPresentationContent> {
    const { data } = await api.post<{ data: GeneratedPresentationContent }>(
      "/ai-generation/document-draft",
      { prompt, format: "ppt" },
      { signal }
    );
    return data.data;
  },

  // Step 2: send the structured content to the backend, which renders it into a
  // file and stores it as an already-confirmed attachment.
  async generatePdf(payload: GenerateDocumentPayload): Promise<ChatAttachment> {
    const { data } = await api.post<{ data: ChatAttachment }>("/document-generation/pdf", payload);
    return data.data;
  },

  async generatePpt(payload: GeneratePresentationPayload): Promise<ChatAttachment> {
    const { data } = await api.post<{ data: ChatAttachment }>("/document-generation/ppt", payload);
    return data.data;
  },
};
