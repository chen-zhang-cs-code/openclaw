export async function resetTestMemoryEmbeddingProviderRegistry(): Promise<void> {
  const [{ clearMemoryEmbeddingProviders, registerMemoryEmbeddingProvider }, { registerBuiltInMemoryEmbeddingProviders }] =
    await Promise.all([
      import("../../../../src/plugins/memory-embedding-providers.js"),
      import("./provider-adapters.js"),
    ]);
  clearMemoryEmbeddingProviders();
  registerBuiltInMemoryEmbeddingProviders({ registerMemoryEmbeddingProvider });
}

export async function clearTestMemoryEmbeddingProviderRegistry(): Promise<void> {
  const { clearMemoryEmbeddingProviders } = await import(
    "../../../../src/plugins/memory-embedding-providers.js"
  );
  clearMemoryEmbeddingProviders();
}
