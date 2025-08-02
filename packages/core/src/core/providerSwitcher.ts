/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

export interface ProviderConfig {
  id: string;
  enabled: boolean;
  apiKeys: string[];
}

export interface ProvidersConfig {
  providers: ProviderConfig[];
  fallbackOrder: string[];
}

/**
 * Fast provider switching utilities
 */
export class ProviderSwitcher {
  private configPath: string;
  private config: ProvidersConfig | null = null;

  constructor() {
    this.configPath = resolve(process.cwd(), 'providers.json');
  }

  async loadConfig(): Promise<ProvidersConfig> {
    if (this.config) return this.config;
    
    try {
      const configFile = await readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configFile);
    } catch (error) {
      this.config = { providers: [], fallbackOrder: [] };
    }
    
    // TypeScript guard: this.config is never null after this point
    return this.config!;
  }

  async saveConfig(): Promise<void> {
    if (!this.config) {
      this.config = { providers: [], fallbackOrder: [] };
    }
    
    await writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  async switchToPrimary(providerId: string): Promise<void> {
    const config = await this.loadConfig();
    
    // Check if provider exists
    const provider = config.providers.find(p => p.id === providerId);
    if (!provider) {
      throw new Error(`Provider '${providerId}' not found. Available providers: ${config.providers.map(p => p.id).join(', ')}`);
    }

    // Move to front of fallback order
    config.fallbackOrder = [
      providerId,
      ...config.fallbackOrder.filter(p => p !== providerId)
    ];

    await this.saveConfig();
    console.log(`✅ Switched to '${providerId}' as primary provider`);
  }

  async enableProvider(providerId: string): Promise<void> {
    const config = await this.loadConfig();
    
    const provider = config.providers.find(p => p.id === providerId);
    if (!provider) {
      throw new Error(`Provider '${providerId}' not found`);
    }

    provider.enabled = true;
    await this.saveConfig();
    console.log(`✅ Enabled provider '${providerId}'`);
  }

  async disableProvider(providerId: string): Promise<void> {
    const config = await this.loadConfig();
    
    const provider = config.providers.find(p => p.id === providerId);
    if (!provider) {
      throw new Error(`Provider '${providerId}' not found`);
    }

    provider.enabled = false;
    
    // Remove from fallback order
    config.fallbackOrder = config.fallbackOrder.filter(p => p !== providerId);
    
    await this.saveConfig();
    console.log(`✅ Disabled provider '${providerId}'`);
  }

  async getCurrentProvider(): Promise<string | null> {
    const config = await this.loadConfig();
    
    // Return the first enabled provider in fallback order
    for (const providerId of config.fallbackOrder) {
      const provider = config.providers.find(p => p.id === providerId);
      if (provider && provider.enabled) {
        return providerId;
      }
    }
    
    return null;
  }

  async getAvailableProviders(): Promise<ProviderConfig[]> {
    const config = await this.loadConfig();
    return config.providers;
  }

  async showStatus(): Promise<void> {
    const config = await this.loadConfig();
    const current = await this.getCurrentProvider();
    
    console.log('\n📊 Provider Status:');
    console.log(`🎯 Current Primary: ${current || 'None'}`);
    console.log('\n📋 All Providers:');
    
    for (const provider of config.providers) {
      const status = provider.enabled ? '✅ enabled' : '❌ disabled';
      const isPrimary = provider.id === current ? ' (PRIMARY)' : '';
      const keyCount = provider.apiKeys.length;
      
      console.log(`  • ${provider.id} (${keyCount} keys) - ${status}${isPrimary}`);
    }
    
    if (config.fallbackOrder.length > 0) {
      console.log(`\n🔄 Fallback Order: ${config.fallbackOrder.join(' → ')}`);
    }
  }

  async quickSwitch(model: string): Promise<string> {
    // Determine the best provider for a given model
    if (model.startsWith('deepseek/') || model.startsWith('openai/') || model.startsWith('anthropic/')) {
      await this.switchToPrimary('openrouter');
      return 'openrouter';
    } else if (model.startsWith('gemini-')) {
      // Check if we have a gemini provider, otherwise use default Gemini API
      const config = await this.loadConfig();
      const geminiProvider = config.providers.find(p => p.id === 'gemini');
      if (geminiProvider) {
        await this.switchToPrimary('gemini');
        return 'gemini';
      }
    }
    
    return 'auto';
  }
}

export const providerSwitcher = new ProviderSwitcher();
