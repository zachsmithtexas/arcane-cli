/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommandKind, SlashCommand } from './types.js';
import { MessageType } from '../types.js';
import { enhancedProviderRouter } from '@google/gemini-cli-core';

export const usageCommand: SlashCommand = {
  name: 'usage',
  altNames: ['track', 'stats'],
  description: 'Show provider usage statistics. Usage: /usage [reset]',
  kind: CommandKind.BUILT_IN,
  action: async (context) => {
    const args = context.invocation?.args?.trim() || '';
    
    if (args === 'reset') {
      enhancedProviderRouter.resetStats();
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `✅ **Usage statistics reset successfully!**\n\nAll provider statistics have been cleared.`,
        },
        Date.now(),
      );
      return;
    }
    
    // Show usage statistics
    const usageStats = enhancedProviderRouter.getUsageStats();
    const providerStats = enhancedProviderRouter.getProviderStats();
    
    let report = `📊 **Provider Usage Statistics**\n\n`;
    
    // Overall stats
    const totalRequests = usageStats.totalRequests;
    const overallSuccessRate = totalRequests > 0 
      ? ((usageStats.totalSuccesses / totalRequests) * 100).toFixed(1)
      : '0';
    
    report += `**Overall Summary:**\n`;
    report += `   Total Requests: ${totalRequests}\n`;
    report += `   Success Rate: ${overallSuccessRate}%\n`;
    report += `   Rate Limits: ${usageStats.totalRateLimits}\n\n`;
    
    // Per-provider breakdown
    report += `**Provider Breakdown:**\n`;
    
    for (const [providerId, stats] of Object.entries(usageStats.providerBreakdown)) {
      const providerName = getProviderDisplayName(providerId);
      const statsObj = stats as any;
      
      if (statsObj.requests === 0) {
        report += `${providerName}: No usage yet\n`;
        continue;
      }
      
      const successRate = statsObj.successRate.toFixed(1);
      const avgResponse = statsObj.avgResponseTime.toFixed(0);
      
      report += `${providerName}:\n`;
      report += `   Requests: ${statsObj.requests} (${successRate}% success)\n`;
      report += `   Failures: ${statsObj.failures} | Rate Limits: ${statsObj.rateLimits}\n`;
      report += `   Avg Response: ${avgResponse}ms\n`;
      
      // Show per-key stats if available
      const keyStats = providerStats[providerId] as Record<string, any> | undefined;
      if (keyStats && Object.keys(keyStats).length > 1) {
        report += `   API Keys:\n`;
        for (const [maskedKey, keyData] of Object.entries(keyStats)) {
          const keyDataObj = keyData as any;
          const keySuccessRate = keyDataObj.requests > 0 
            ? ((keyDataObj.successes / keyDataObj.requests) * 100).toFixed(1)
            : '0';
          report += `     ${maskedKey}: ${keyDataObj.requests} requests (${keySuccessRate}% success)\n`;
        }
      }
      report += '\n';
    }
    
    // API key rotation info
    const currentModel = enhancedProviderRouter.getCurrentModel();
    const currentProvider = getProviderForModel(currentModel);
    const currentKeyIndex = enhancedProviderRouter.getCurrentApiKeyIndex(currentProvider);
    
    report += `**Current Session:**\n`;
    report += `   Model: \`${currentModel}\`\n`;
    report += `   Provider: ${getProviderDisplayName(currentProvider)}\n`;
    report += `   API Key Index: ${currentKeyIndex}\n\n`;
    
    report += `💡 **Commands**: \`/usage reset\` to clear stats`;
    
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: report,
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
