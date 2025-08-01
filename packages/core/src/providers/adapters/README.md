# Provider Adapters

This directory contains the adapters for different AI providers. Each adapter must implement the `ProviderAdapter` interface defined in `../loader.ts`.

## Adding a New Provider

1.  Create a new file in this directory named after the provider (e.g., `openrouter.ts`).
2.  Implement the `ProviderAdapter` interface in your new file.
3.  Update the `providers.json` configuration file in the root of the project to include your new provider.

Your new provider will then be available to the `ProviderManager`.
