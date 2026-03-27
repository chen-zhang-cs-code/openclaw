import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGoogleImageGenerationProvider } from "./image-generation-provider.js";
import { __testing as geminiWebSearchTesting } from "./src/gemini-web-search-provider.js";

const { resolveApiKeyForProviderMock } = vi.hoisted(() => ({
  resolveApiKeyForProviderMock: vi.fn(),
}));
const { postJsonRequestMock } = vi.hoisted(() => ({
  postJsonRequestMock: vi.fn(),
}));

vi.mock("openclaw/plugin-sdk/provider-auth", () => {
  return {
    resolveApiKeyForProvider: resolveApiKeyForProviderMock,
  };
});
vi.mock("openclaw/plugin-sdk/provider-http", () => ({
  assertOkOrThrowHttpError: async (res: { ok?: boolean; status?: number }, label: string) => {
    if (!res.ok) {
      throw new Error(`${label} (HTTP ${res.status ?? 500})`);
    }
  },
  normalizeBaseUrl: (baseUrl: string | undefined, fallback: string) =>
    (baseUrl?.trim() || fallback).replace(/\/+$/, ""),
  postJsonRequest: postJsonRequestMock,
}));

function mockGoogleApiKeyAuth() {
  resolveApiKeyForProviderMock.mockResolvedValue({
    apiKey: "google-test-key",
    source: "env",
    mode: "api-key",
  });
}

function installGoogleRequestMock(params?: {
  data?: string;
  mimeType?: string;
  inlineDataKey?: "inlineData" | "inline_data";
}) {
  const mimeType = params?.mimeType ?? "image/png";
  const data = params?.data ?? "png-data";
  const inlineDataKey = params?.inlineDataKey ?? "inlineData";
  const release = vi.fn(async () => undefined);
  postJsonRequestMock.mockResolvedValue({
    response: {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  [inlineDataKey]: {
                    [inlineDataKey === "inlineData" ? "mimeType" : "mime_type"]: mimeType,
                    data: Buffer.from(data).toString("base64"),
                  },
                },
              ],
            },
          },
        ],
      }),
    },
    release,
  });
  return { release };
}

describe("Google image-generation provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resolveApiKeyForProviderMock.mockReset();
    postJsonRequestMock.mockReset();
  });

  it("generates image buffers from the Gemini generateContent API", async () => {
    resolveApiKeyForProviderMock.mockResolvedValue({
      apiKey: "google-test-key",
      source: "env",
      mode: "api-key",
    });
    const { release } = installGoogleRequestMock();

    const provider = buildGoogleImageGenerationProvider();
    const result = await provider.generateImage({
      provider: "google",
      model: "gemini-3.1-flash-image-preview",
      prompt: "draw a cat",
      cfg: {},
      size: "1536x1024",
    });

    expect(postJsonRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent",
        body: {
          contents: [
            {
              role: "user",
              parts: [{ text: "draw a cat" }],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: {
              aspectRatio: "3:2",
              imageSize: "2K",
            },
          },
        },
      }),
    );
    expect(release).toHaveBeenCalledOnce();
    expect(result).toEqual({
      images: [
        {
          buffer: Buffer.from("png-data"),
          mimeType: "image/png",
          fileName: "image-1.png",
        },
      ],
      model: "gemini-3.1-flash-image-preview",
    });
  });

  it("accepts OAuth JSON auth and inline_data responses", async () => {
    resolveApiKeyForProviderMock.mockResolvedValue({
      apiKey: JSON.stringify({ token: "oauth-token" }),
      source: "profile",
      mode: "token",
    });
    installGoogleRequestMock({
      data: "jpg-data",
      mimeType: "image/jpeg",
      inlineDataKey: "inline_data",
    });

    const provider = buildGoogleImageGenerationProvider();
    const result = await provider.generateImage({
      provider: "google",
      model: "gemini-3.1-flash-image-preview",
      prompt: "draw a dog",
      cfg: {},
    });

    const request = postJsonRequestMock.mock.calls[0]?.[0];
    expect(request).toEqual(
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    expect(new Headers(request.headers).get("authorization")).toBe("Bearer oauth-token");
    expect(result).toEqual({
      images: [
        {
          buffer: Buffer.from("jpg-data"),
          mimeType: "image/jpeg",
          fileName: "image-1.jpg",
        },
      ],
      model: "gemini-3.1-flash-image-preview",
    });
  });

  it("sends reference images and explicit resolution for edit flows", async () => {
    mockGoogleApiKeyAuth();
    installGoogleRequestMock();

    const provider = buildGoogleImageGenerationProvider();
    await provider.generateImage({
      provider: "google",
      model: "gemini-3-pro-image-preview",
      prompt: "Change only the sky to a sunset.",
      cfg: {},
      resolution: "4K",
      inputImages: [
        {
          buffer: Buffer.from("reference-bytes"),
          mimeType: "image/png",
          fileName: "reference.png",
        },
      ],
    });

    expect(postJsonRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
        body: {
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: Buffer.from("reference-bytes").toString("base64"),
                  },
                },
                { text: "Change only the sky to a sunset." },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: {
              imageSize: "4K",
            },
          },
        },
      }),
    );
  });

  it("forwards explicit aspect ratio without forcing a default when size is omitted", async () => {
    mockGoogleApiKeyAuth();
    installGoogleRequestMock();

    const provider = buildGoogleImageGenerationProvider();
    await provider.generateImage({
      provider: "google",
      model: "gemini-3-pro-image-preview",
      prompt: "portrait photo",
      cfg: {},
      aspectRatio: "9:16",
    });

    expect(postJsonRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
        body: {
          contents: [
            {
              role: "user",
              parts: [{ text: "portrait photo" }],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: {
              aspectRatio: "9:16",
            },
          },
        },
      }),
    );
  });

  it("normalizes a configured bare Google host to the v1beta API root", async () => {
    mockGoogleApiKeyAuth();
    installGoogleRequestMock();

    const provider = buildGoogleImageGenerationProvider();
    await provider.generateImage({
      provider: "google",
      model: "gemini-3-pro-image-preview",
      prompt: "draw a cat",
      cfg: {
        models: {
          providers: {
            google: {
              baseUrl: "https://generativelanguage.googleapis.com",
              models: [],
            },
          },
        },
      },
    });

    expect(postJsonRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
      }),
    );
  });

  it("prefers scoped configured Gemini API keys over environment fallbacks", () => {
    expect(
      geminiWebSearchTesting.resolveGeminiApiKey({
        apiKey: "gemini-secret",
      }),
    ).toBe("gemini-secret");
  });

  it("falls back to the default Gemini model when unset or blank", () => {
    expect(geminiWebSearchTesting.resolveGeminiModel()).toBe("gemini-2.5-flash");
    expect(geminiWebSearchTesting.resolveGeminiModel({ model: "  " })).toBe("gemini-2.5-flash");
    expect(geminiWebSearchTesting.resolveGeminiModel({ model: "gemini-2.5-pro" })).toBe(
      "gemini-2.5-pro",
    );
  });
});
