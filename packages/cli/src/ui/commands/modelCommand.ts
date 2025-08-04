/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommandKind, SlashCommand } from './types.js';
import { MessageType } from '../types.js';
import { enhancedProviderRouter } from '@google/gemini-cli-core';

export const modelCommand: SlashCommand = {
  name: 'model',
  altNames: ['m'],
  description: 'Switch AI model. Usage: /model [list|<model-name>]',
  kind: CommandKind.BUILT_IN,
  action: async (context) => {
    const args = context.invocation?.args?.trim() || '';
    
    if (!args || args === 'list') {
      // Show available models
      const models = enhancedProviderRouter.getAllModels();
      const currentModel = enhancedProviderRouter.getCurrentModel();
      
      let modelList = `🎯 **Available Models** (current: \`${currentModel}\`)\n\n`;
      
      for (const [providerId, modelArray] of Object.entries(models)) {
        const providerName = getProviderDisplayName(providerId);
        const modelsList = modelArray as string[];
        modelList += `**${providerName}** (${modelsList.length} models):\n`;
        
        // Show first 5 models, then "..." if more
        const displayModels = modelsList.slice(0, 5);
        for (const model of displayModels) {
          const isActive = model === currentModel ? '👉 ' : '   ';
          modelList += `${isActive}\`${model}\`\n`;
        }
        
        if (modelsList.length > 5) {
          modelList += `   ... and ${modelsList.length - 5} more\n`;
        }
        modelList += '\n';
      }
      
      modelList += `💡 **Usage**: \`/model <model-name>\` to switch\n`;
      modelList += `💡 **Quick switch**: \`/m deepseek/deepseek-r1:free\``;
      
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: modelList,
        },
        Date.now(),
      );
      return;
    }
    
    // Switch to specific model
    const targetModel = args;
    const previousModel = enhancedProviderRouter.getCurrentModel();
    
    // Check if model exists
    const allModels = enhancedProviderRouter.getAllModels();
    const allModelsList = Object.values(allModels).flat();
    
    if (!allModelsList.includes(targetModel)) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: `❌ Model \`${targetModel}\` not found. Use \`/model list\` to see available models.`,
        },
        Date.now(),
      );
      return;
    }
    
    // Switch model
    enhancedProviderRouter.setCurrentModel(targetModel);
    
    // Determine provider
    const provider = getProviderForModel(targetModel);
    const providerName = getProviderDisplayName(provider);
    
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `✅ **Model switched successfully!**\n\n**Previous**: \`${previousModel}\`\n**Current**: \`${targetModel}\`\n**Provider**: ${providerName}\n\n🚀 Ready for next conversation!`,
      },
      Date.now(),
    );
  },
};

function getProviderForModel(model: string): string {
  if (model.includes(':free') || model.includes('/')) {
    if (model.startsWith('deepseek-r1-distill') || model.startsWith('llama-3.3-70b') || model.startsWith('gemma2-')) {
      return 'groq';
    }
    if (model.startsWith('meta-llama/Llama') || model.startsWith('lgai/') || model.startsWith('deepseek-ai/')) {
      return 'together';
    }
    if (model.includes(':') && !model.includes(':free')) {
      return 'ollama';
    }
    return 'openrouter';
  }
  if (model.startsWith('gemini-')) {
    return 'gemini';
  }
  return 'openrouter';
}

function getProviderDisplayName(providerId: string): string {
  const displayNames: Record<string, string> = {
    'openrouter': '🌐 OpenRouter',
    'groq': '⚡ Groq',
    'together': '🤝 Together.ai',
    'ollama': '🦙 Ollama',
    'gemini': '💎 Google Gemini'
  };
  return displayNames[providerId] || `❓ ${providerId}`;
}
