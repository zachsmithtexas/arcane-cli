# Provider Adapters

This directory contains the adapters for different AI providers. Each adapter must implement the `ProviderAdapter` interface defined in `../loader.ts`.

## Provider Adapter Interface

The `ProviderAdapter` interface requires the following implementation:

```typescript
export interface ProviderAdapter {
  readonly id: string; // Unique provider identifier
  setApiKey(apiKey: string): void; // Set/update the API key
  generateContent(prompt: string): Promise<string>; // Generate AI content
}
```

## Key Rotation Support

Provider adapters now support automatic API key rotation and fallback. The system will:

- Automatically rotate to the next available key on failures
- Track failure rates and temporarily disable problematic keys
- Reset rate-limited keys after configurable backoff periods
- Log failures for debugging and monitoring

### Error Handling

When implementing `generateContent()`, throw meaningful errors that can be categorized:

- Rate limit errors: Include "rate limit", "quota", or "429" in the message
- Invalid key errors: Include "invalid" and "key" in the message
- Network errors: Include "network" or "timeout" in the message

## Adding a New Provider

1. Create a new file in this directory named after the provider (e.g., `openrouter.ts`).
2. Implement the `ProviderAdapter` interface in your new file:

```typescript
export default class YourProviderAdapter implements ProviderAdapter {
  readonly id = 'your-provider';
  private apiKey = '';

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  async generateContent(prompt: string): Promise<string> {
    // Your implementation here
  }
}
```

3. Update the `providers.json` configuration file to include your new provider:

```json
{
  "providers": [
    {
      "id": "your-provider",
      "apiKeys": ["key1", "key2"],
      "enabled": true,
      "keyRotationConfig": {
        "maxFailuresBeforeDisable": 5,
        "rateLimitBackoffMinutes": 60
      }
    }
  ]
}
```

4. Add tests for your provider in a corresponding `.test.ts` file.

Your new provider will then be available to the `ProviderManager` with full key rotation support.

## Configuration Options

### Provider Configuration

- `id`: Unique identifier for the provider
- `apiKeys`: Array of API keys (supports both string keys and metadata objects)
- `apiKey`: Legacy single key support (automatically converted to `apiKeys`)
- `enabled`: Whether the provider is active
- `keyRotationConfig`: Optional key rotation behavior overrides

### Key Rotation Configuration

- `maxFailuresBeforeDisable`: Maximum failures before disabling a key (default: 5)
- `failureResetTimeHours`: Hours to wait before resetting failure count (default: 24)
- `rateLimitBackoffMinutes`: Minutes to wait after rate limit (default: 60)
- `enableAutoRotation`: Whether to automatically rotate keys on failure (default: true)
- `enableFailureLogging`: Whether to log failures (default: true)

## CLI Management

Use the CLI to manage providers and keys:

```bash
# List providers and their keys
gemini provider list
gemini provider keys list

# Add a new provider
gemini provider add --id openrouter --api-key your-key

# Add additional keys to existing provider
gemini provider keys add --provider gemini --key your-new-key

# Set a specific key as primary
gemini provider keys set --provider gemini --key your-preferred-key

# View key statistics and failure information
gemini provider keys status
```
