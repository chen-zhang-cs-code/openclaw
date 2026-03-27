import {
  BUNDLED_IMAGE_GENERATION_PLUGIN_IDS,
  BUNDLED_MEDIA_UNDERSTANDING_PLUGIN_IDS,
  BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS,
  BUNDLED_PROVIDER_PLUGIN_IDS,
  BUNDLED_RUNTIME_CONTRACT_PLUGIN_IDS,
  BUNDLED_SPEECH_PLUGIN_IDS,
  BUNDLED_WEB_SEARCH_PLUGIN_IDS,
} from "../bundled-capability-metadata.js";
import {
  capturePluginRegistration,
  type CapturedPluginRegistration,
} from "../captured-registration.js";
import type {
  ImageGenerationProviderPlugin,
  MediaUnderstandingProviderPlugin,
  OpenClawPluginApi,
  ProviderPlugin,
  SpeechProviderPlugin,
  WebSearchProviderPlugin,
} from "../types.js";

type CapabilityContractEntry<T> = {
  pluginId: string;
  provider: T;
};

type ProviderContractEntry = CapabilityContractEntry<ProviderPlugin>;

type WebSearchProviderContractEntry = CapabilityContractEntry<WebSearchProviderPlugin> & {
  credentialValue: unknown;
};

type SpeechProviderContractEntry = CapabilityContractEntry<SpeechProviderPlugin>;
type MediaUnderstandingProviderContractEntry =
  CapabilityContractEntry<MediaUnderstandingProviderPlugin>;
type ImageGenerationProviderContractEntry = CapabilityContractEntry<ImageGenerationProviderPlugin>;

type PluginRegistrationContractEntry = {
  pluginId: string;
  cliBackendIds: string[];
  providerIds: string[];
  speechProviderIds: string[];
  mediaUnderstandingProviderIds: string[];
  imageGenerationProviderIds: string[];
  webSearchProviderIds: string[];
  toolNames: string[];
};

type ContractPluginRegister = (api: OpenClawPluginApi) => void;
type ContractPluginImporter = () => Promise<unknown>;

type LoadedContractRegistries = {
  providerContractRegistry: ProviderContractEntry[];
  webSearchProviderContractRegistry: WebSearchProviderContractEntry[];
  speechProviderContractRegistry: SpeechProviderContractEntry[];
  mediaUnderstandingProviderContractRegistry: MediaUnderstandingProviderContractEntry[];
  imageGenerationProviderContractRegistry: ImageGenerationProviderContractEntry[];
};

type LoadContractRuntimeRegistriesResult = {
  registries: LoadedContractRegistries;
  loadError?: Error;
};

type ContractPluginLoadFailure = {
  pluginId: string;
  error: Error;
};

const CONTRACT_PLUGIN_IMPORTERS: Record<string, ContractPluginImporter> = {
  "amazon-bedrock": () => import("../../../extensions/amazon-bedrock/index.js"),
  anthropic: () => import("../../../extensions/anthropic/index.js"),
  brave: () => import("../../../extensions/brave/index.js"),
  byteplus: () => import("../../../extensions/byteplus/index.js"),
  chutes: () => import("../../../extensions/chutes/index.js"),
  "cloudflare-ai-gateway": () => import("../../../extensions/cloudflare-ai-gateway/index.js"),
  "copilot-proxy": () => import("../../../extensions/copilot-proxy/index.js"),
  deepgram: () => import("../../../extensions/deepgram/index.js"),
  deepseek: () => import("../../../extensions/deepseek/index.js"),
  duckduckgo: () => import("../../../extensions/duckduckgo/index.js"),
  elevenlabs: () => import("../../../extensions/elevenlabs/index.js"),
  exa: () => import("../../../extensions/exa/index.js"),
  fal: () => import("../../../extensions/fal/index.js"),
  firecrawl: () => import("../../../extensions/firecrawl/index.js"),
  "github-copilot": () => import("../../../extensions/github-copilot/index.js"),
  google: () => import("../../../extensions/google/index.js"),
  groq: () => import("../../../extensions/groq/index.js"),
  huggingface: () => import("../../../extensions/huggingface/index.js"),
  kilocode: () => import("../../../extensions/kilocode/index.js"),
  kimi: () => import("../../../extensions/kimi-coding/index.js"),
  microsoft: () => import("../../../extensions/microsoft/index.js"),
  "microsoft-foundry": () => import("../../../extensions/microsoft-foundry/index.js"),
  minimax: () => import("../../../extensions/minimax/index.js"),
  mistral: () => import("../../../extensions/mistral/index.js"),
  modelstudio: () => import("../../../extensions/modelstudio/index.js"),
  moonshot: () => import("../../../extensions/moonshot/index.js"),
  nvidia: () => import("../../../extensions/nvidia/index.js"),
  ollama: () => import("../../../extensions/ollama/index.js"),
  openai: () => import("../../../extensions/openai/index.js"),
  opencode: () => import("../../../extensions/opencode/index.js"),
  "opencode-go": () => import("../../../extensions/opencode-go/index.js"),
  openrouter: () => import("../../../extensions/openrouter/index.js"),
  perplexity: () => import("../../../extensions/perplexity/index.js"),
  qianfan: () => import("../../../extensions/qianfan/index.js"),
  sglang: () => import("../../../extensions/sglang/index.js"),
  synthetic: () => import("../../../extensions/synthetic/index.js"),
  tavily: () => import("../../../extensions/tavily/index.js"),
  together: () => import("../../../extensions/together/index.js"),
  venice: () => import("../../../extensions/venice/index.js"),
  "vercel-ai-gateway": () => import("../../../extensions/vercel-ai-gateway/index.js"),
  vllm: () => import("../../../extensions/vllm/index.js"),
  volcengine: () => import("../../../extensions/volcengine/index.js"),
  xai: () => import("../../../extensions/xai/index.js"),
  xiaomi: () => import("../../../extensions/xiaomi/index.js"),
  zai: () => import("../../../extensions/zai/index.js"),
};

function uniqueStrings(values: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function resolveContractPluginRegister(moduleExport: unknown): ContractPluginRegister | undefined {
  const resolved =
    moduleExport &&
    typeof moduleExport === "object" &&
    "default" in (moduleExport as Record<string, unknown>)
      ? (moduleExport as { default: unknown }).default
      : moduleExport;
  if (typeof resolved === "function") {
    return resolved as ContractPluginRegister;
  }
  if (resolved && typeof resolved === "object") {
    const definition = resolved as {
      register?: ContractPluginRegister;
      activate?: ContractPluginRegister;
    };
    return definition.register ?? definition.activate;
  }
  return undefined;
}

async function loadContractPluginRegistration(params: {
  pluginId: string;
}): Promise<{ pluginId: string; captured: CapturedPluginRegistration }> {
  const importer = CONTRACT_PLUGIN_IMPORTERS[params.pluginId];
  if (!importer) {
    throw new Error(`missing contract plugin importer for ${params.pluginId}`);
  }
  const register = resolveContractPluginRegister(await importer());
  if (!register) {
    throw new Error(`contract plugin ${params.pluginId} missing register/activate export`);
  }
  return {
    pluginId: params.pluginId,
    captured: capturePluginRegistration({ register }),
  };
}

function resolveWebSearchCredentialValue(provider: WebSearchProviderPlugin): unknown {
  if (provider.requiresCredential === false) {
    return `${provider.id}-no-key-needed`;
  }
  const envVar = provider.envVars.find((entry) => entry.trim().length > 0);
  if (!envVar) {
    return `${provider.id}-test`;
  }
  if (envVar === "OPENROUTER_API_KEY") {
    return "openrouter-test";
  }
  return envVar.toLowerCase().includes("api_key") ? `${provider.id}-test` : "sk-test";
}

async function loadContractRuntimeRegistries(): Promise<LoadContractRuntimeRegistriesResult> {
  const missingImporters = BUNDLED_RUNTIME_CONTRACT_PLUGIN_IDS.filter(
    (pluginId) => !CONTRACT_PLUGIN_IMPORTERS[pluginId],
  );
  if (missingImporters.length > 0) {
    throw new Error(
      `missing contract plugin importers: ${missingImporters.toSorted((a, b) => a.localeCompare(b)).join(", ")}`,
    );
  }

  const registrations: Array<{ pluginId: string; captured: CapturedPluginRegistration }> = [];
  const failures: ContractPluginLoadFailure[] = [];
  for (const pluginId of BUNDLED_RUNTIME_CONTRACT_PLUGIN_IDS) {
    try {
      registrations.push(await loadContractPluginRegistration({ pluginId }));
    } catch (error) {
      failures.push({
        pluginId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  return {
    registries: {
      providerContractRegistry: registrations.flatMap(({ pluginId, captured }) =>
        captured.providers.map((provider) => ({
          pluginId,
          provider: {
            ...provider,
            pluginId,
          },
        })),
      ),
      webSearchProviderContractRegistry: registrations.flatMap(({ pluginId, captured }) =>
        captured.webSearchProviders.map((provider) => ({
          pluginId,
          provider,
          credentialValue: resolveWebSearchCredentialValue(provider),
        })),
      ),
      speechProviderContractRegistry: registrations.flatMap(({ pluginId, captured }) =>
        captured.speechProviders.map((provider) => ({
          pluginId,
          provider,
        })),
      ),
      mediaUnderstandingProviderContractRegistry: registrations.flatMap(({ pluginId, captured }) =>
        captured.mediaUnderstandingProviders.map((provider) => ({
          pluginId,
          provider,
        })),
      ),
      imageGenerationProviderContractRegistry: registrations.flatMap(({ pluginId, captured }) =>
        captured.imageGenerationProviders.map((provider) => ({
          pluginId,
          provider,
        })),
      ),
    },
    loadError:
      failures.length > 0
        ? new Error(
            `failed to load contract plugins: ${failures
              .map(({ pluginId, error }) => `${pluginId}: ${error.message}`)
              .join("; ")}`,
          )
        : undefined,
  };
}

let loadedContractRegistries: LoadedContractRegistries = {
  providerContractRegistry: [],
  webSearchProviderContractRegistry: [],
  speechProviderContractRegistry: [],
  mediaUnderstandingProviderContractRegistry: [],
  imageGenerationProviderContractRegistry: [],
};

export let providerContractLoadError: Error | undefined;

try {
  const result = await loadContractRuntimeRegistries();
  loadedContractRegistries = result.registries;
  providerContractLoadError = result.loadError;
} catch (error) {
  providerContractLoadError = error instanceof Error ? error : new Error(String(error));
}

function loadUniqueProviderContractProviders(): ProviderPlugin[] {
  return [
    ...new Map(
      loadedContractRegistries.providerContractRegistry.map((entry) => [entry.provider.id, entry.provider]),
    ).values(),
  ];
}

export const providerContractRegistry: ProviderContractEntry[] =
  loadedContractRegistries.providerContractRegistry;

export const uniqueProviderContractProviders: ProviderPlugin[] = loadUniqueProviderContractProviders();

export const providerContractPluginIds: string[] = [...BUNDLED_PROVIDER_PLUGIN_IDS];

export const providerContractCompatPluginIds: string[] = providerContractPluginIds.map((pluginId) =>
  pluginId === "kimi-coding" ? "kimi" : pluginId,
);

export function requireProviderContractProvider(providerId: string): ProviderPlugin {
  const provider = uniqueProviderContractProviders.find((entry) => entry.id === providerId);
  if (!provider) {
    if (providerContractLoadError) {
      throw new Error(
        `provider contract entry missing for ${providerId}; bundled provider registry failed to load: ${providerContractLoadError.message}`,
      );
    }
    throw new Error(`provider contract entry missing for ${providerId}`);
  }
  return provider;
}

export function resolveProviderContractPluginIdsForProvider(
  providerId: string,
): string[] | undefined {
  const pluginIds = [
    ...new Set(
      providerContractRegistry
        .filter((entry) => entry.provider.id === providerId)
        .map((entry) => entry.pluginId),
    ),
  ];
  return pluginIds.length > 0 ? pluginIds : undefined;
}

export function resolveProviderContractProvidersForPluginIds(
  pluginIds: readonly string[],
): ProviderPlugin[] {
  const allowed = new Set(pluginIds);
  return [
    ...new Map(
      providerContractRegistry
        .filter((entry) => allowed.has(entry.pluginId))
        .map((entry) => [entry.provider.id, entry.provider]),
    ).values(),
  ];
}

export const webSearchProviderContractRegistry: WebSearchProviderContractEntry[] =
  loadedContractRegistries.webSearchProviderContractRegistry.filter((entry) =>
    BUNDLED_WEB_SEARCH_PLUGIN_IDS.includes(entry.pluginId),
  );

export const speechProviderContractRegistry: SpeechProviderContractEntry[] =
  loadedContractRegistries.speechProviderContractRegistry.filter((entry) =>
    BUNDLED_SPEECH_PLUGIN_IDS.includes(entry.pluginId),
  );

export const mediaUnderstandingProviderContractRegistry: MediaUnderstandingProviderContractEntry[] =
  loadedContractRegistries.mediaUnderstandingProviderContractRegistry.filter((entry) =>
    BUNDLED_MEDIA_UNDERSTANDING_PLUGIN_IDS.includes(entry.pluginId),
  );

export const imageGenerationProviderContractRegistry: ImageGenerationProviderContractEntry[] =
  loadedContractRegistries.imageGenerationProviderContractRegistry.filter((entry) =>
    BUNDLED_IMAGE_GENERATION_PLUGIN_IDS.includes(entry.pluginId),
  );

function loadPluginRegistrationContractRegistry(): PluginRegistrationContractEntry[] {
  return BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS.map((entry) => ({
    pluginId: entry.pluginId,
    cliBackendIds: uniqueStrings(entry.cliBackendIds),
    providerIds: uniqueStrings(entry.providerIds),
    speechProviderIds: uniqueStrings(entry.speechProviderIds),
    mediaUnderstandingProviderIds: uniqueStrings(entry.mediaUnderstandingProviderIds),
    imageGenerationProviderIds: uniqueStrings(entry.imageGenerationProviderIds),
    webSearchProviderIds: uniqueStrings(entry.webSearchProviderIds),
    toolNames: uniqueStrings(entry.toolNames),
  }));
}

export const pluginRegistrationContractRegistry: PluginRegistrationContractEntry[] =
  loadPluginRegistrationContractRegistry();
