import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("plugin contract registry partial failures", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("../../../extensions/xai/index.js");
    vi.resetModules();
  });

  it("keeps surviving contract registries loaded when one plugin importer fails", async () => {
    vi.doMock("../../../extensions/xai/index.js", () => {
      return {
        get default() {
          throw new Error("xai import failed for test");
        },
      };
    });

    const {
      providerContractLoadError,
      providerContractRegistry,
      webSearchProviderContractRegistry,
    } = await import("./registry.js");

    expect(providerContractLoadError).toBeInstanceOf(Error);
    expect(providerContractLoadError?.message).toContain("xai");
    expect(providerContractLoadError?.message).toContain("xai import failed for test");
    expect(providerContractRegistry.length).toBeGreaterThan(0);
    expect(providerContractRegistry.some((entry) => entry.pluginId === "xai")).toBe(false);
    expect(providerContractRegistry.some((entry) => entry.pluginId === "openai")).toBe(true);
    expect(webSearchProviderContractRegistry.some((entry) => entry.pluginId === "brave")).toBe(
      true,
    );
  });
});
