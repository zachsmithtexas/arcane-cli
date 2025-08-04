/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommandKind, SlashCommand } from './types.js';
import { MessageType } from '../types.js';
import { enhancedProviderRouter } from '@google/gemini-cli-core';

export const providerCommand: SlashCommand = {
  name: 'provider',
  altNames: ['p'],
  description: 'Switch provider. Usage: /provider [list|status|<provider-name>]',
  kind: CommandKind.BUILT_IN,
  action: async (context) => {
    const args = context.invocation?.args?.trim() || '';
    
    if (!args || args === 'list') {
      // Show available providers
      const models = enhancedProviderRouter.getAllModels(); 
      const currentModel = enhancedProviderRouter.getCurrentModel();
      const currentProvider = getProviderForModel(currentModel);
      
      let providerList = `🔀 **Available Providers** (current: ${getProviderDisplayName(currentProvider)})\n\n`;
      
      for (const [providerId, modelArray] of Object.entries(models)) {
        const providerName = getProviderDisplayName(providerId);
        const modelsList = modelArray as string[];
        const isActive = providerId === currentProvider ? '👉 ' : '   ';
        const status = await getProviderStatus(providerId);
        
        providerList += `${isActive}**${providerName}** ${status}\n`;
        providerList += `   ${modelsList.length} models available\n`;
        providerList += `   Example: \`${modelsList[0] || 'N/A'}\`\n\n`;
      }
      
      providerList += `💡 **Usage**: \`/provider <name>\` to switch (e.g., \`/p groq\`)\n`;
      providerList += `💡 **Status**: \`/provider status\` for detailed info`;
      
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: providerList,
        },
        Date.now(),
      );
      return;
    }
    
    if (args === 'status') {
      // Show detailed provider status
      const stats = enhancedProviderRouter.getProviderStats();
      const currentModel = enhancedProviderRouter.getCurrentModel();
      const currentProvider = getProviderForModel(currentModel);
      
      let statusReport = `📊 **Provider Status Report**\n\n`;
      statusReport += `**Current**: ${getProviderDisplayName(currentProvider)} (\`${currentModel}\`)\n\n`;
      
      for (const [providerId, providerStats] of Object.entries(stats)) {
        const providerName = getProviderDisplayName(providerId);
        const status = await getProviderStatus(providerId);
        
        statusReport += `**${providerName}** ${status}\n`;
        
        const statsObj = providerStats as Record<string, any>;
        if (Object.keys(statsObj).length === 0) {
          statusReport += `   No usage data yet\n`;
        } else {
          for (const [maskedKey, keyStats] of Object.entries(statsObj)) {
            const keyStatsObj = keyStats as any;
            const successRate = keyStatsObj.requests > 0 
              ? ((keyStatsObj.successes / keyStatsObj.requests) * 100).toFixed(1)
              : '0';
            statusReport += `   Key ${maskedKey}: ${keyStatsObj.requests} requests, ${successRate}% success\n`;
          }
        }
        statusReport += '\n';
      }
      
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: statusReport,
        },
        Date.now(),
      );
      return;
    }
    
    // Switch to specific provider
    const targetProvider = args.toLowerCase();
    const models = enhancedProviderRouter.getAllModels();
    
    if (!models[targetProvider]) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: `❌ Provider \`${targetProvider}\` not found. Use \`/provider list\` to see available providers.`,
        },
        Date.now(),
      );
      return;
    }
    
    // Get default model for provider
    const providerModels = models[targetProvider] as string[];
    if (!providerModels || providerModels.length === 0) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: `❌ Provider \`${targetProvider}\` has no available models.`,
        },
        Date.now(),
      );
      return;
    }
    
    const previousModel = enhancedProviderRouter.getCurrentModel();
    const defaultModel = providerModels[0];
    
    // Switch to provider's default model
    enhancedProviderRouter.setCurrentModel(defaultModel);
    
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `✅ **Provider switched successfully!**\n\n**Previous**: \`${previousModel}\`\n**Provider**: ${getProviderDisplayName(targetProvider)}\n**Model**: \`${defaultModel}\`\n\n🚀 Ready for next conversation!`,
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

async function getProviderStatus(providerId: string): Promise<string> {
  const envVarMap: Record<string, string> = {
    'openrouter': 'OPENROUTER_API_KEY',
    'groq': 'GROQ_API_KEY',
    'together': 'TOGETHER_API_KEY',
    'gemini': 'GEMINI_API_KEY'
  };
  
  const envVar = envVarMap[providerId];
  const hasEnvKey = envVar && process.env[envVar];
  
  if (providerId === 'ollama') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      
      const response = await fetch('http://localhost:11434/api/tags', { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok ? '✅ Running' : '❌ Offline';
    } catch {
      return '❌ Offline';
    }
  }
  
  return hasEnvKey ? '✅ Ready' : '⚠️ No API Key';
}
