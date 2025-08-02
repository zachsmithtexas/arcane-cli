/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simple provider routing based on model names
 * This is a temporary solution until full provider integration is complete
 */

export function shouldUseOpenRouter(model: string): boolean {
  const openRouterModels = [
    'deepseek/',
    'openai/',
    'anthropic/',
    'meta-llama/',
    'qwen/',
    'mistralai/',
    'google/gemini-pro', // Non-Gemini API version
  ];

  return openRouterModels.some((prefix) => model.startsWith(prefix));
}

export function getProviderForModel(model: string): 'gemini' | 'openrouter' {
  return shouldUseOpenRouter(model) ? 'openrouter' : 'gemini';
}
