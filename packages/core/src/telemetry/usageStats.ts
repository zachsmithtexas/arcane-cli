/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/telemetry/usageStats.ts

/**
 * @fileoverview Usage statistics and provider failure tracking system.
 * 
 * This module provides anonymized tracking of command frequency and provider
 * success/failures with local storage and opt-out capabilities.
 */

import { promises as fs } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { z } from 'zod';
import { KeyFailureReason } from '../providers/keys.js';

/**
 * Schema for provider usage statistics.
 */
export const ProviderStatsSchema = z.object({
  providerId: z.string(),
  totalRequests: z.number().default(0),
  successfulRequests: z.number().default(0),
  failedRequests: z.number().default(0),
  lastUsed: z.number().optional(), // Unix timestamp
  averageResponseTime: z.number().default(0),
  failuresByReason: z.record(z.string(), z.number()).default({}),
  keyRotationCount: z.number().default(0),
  rateLimitHits: z.number().default(0),
});

export type ProviderStats = z.infer<typeof ProviderStatsSchema>;

/**
 * Schema for command usage statistics.
 */
export const CommandStatsSchema = z.object({
  command: z.string(),
  usageCount: z.number().default(0),
  lastUsed: z.number().optional(), // Unix timestamp
  averageExecutionTime: z.number().default(0),
  successCount: z.number().default(0),
  errorCount: z.number().default(0),
});

export type CommandStats = z.infer<typeof CommandStatsSchema>;

/**
 * Schema for session statistics.
 */
export const SessionStatsSchema = z.object({
  sessionId: z.string(),
  startTime: z.number(),
  endTime: z.number().optional(),
  commandsExecuted: z.number().default(0),
  totalTokensUsed: z.number().default(0),
  providersUsed: z.array(z.string()).default([]),
  toolCallsExecuted: z.number().default(0),
});

export type SessionStats = z.infer<typeof SessionStatsSchema>;

/**
 * Schema for aggregated usage statistics.
 */
export const UsageStatsSchema = z.object({
  version: z.string().default('1.0.0'),
  enabled: z.boolean().default(true),
  anonymizationEnabled: z.boolean().default(true),
  lastUpdated: z.number(),
  totalSessions: z.number().default(0),
  totalCommands: z.number().default(0),
  providers: z.record(z.string(), ProviderStatsSchema).default({}),
  commands: z.record(z.string(), CommandStatsSchema).default({}),
  sessions: z.array(SessionStatsSchema).default([]),
  installationId: z.string().optional(), // Anonymous installation ID
});

export type UsageStats = z.infer<typeof UsageStatsSchema>;

/**
 * Configuration for usage stats collection.
 */
export interface UsageStatsConfig {
  enabled: boolean;
  anonymizationEnabled: boolean;
  maxSessionHistory: number;
  dataRetentionDays: number;
  statsFilePath?: string;
}

/**
 * Default configuration for usage stats.
 */
export const DEFAULT_STATS_CONFIG: UsageStatsConfig = {
  enabled: true,
  anonymizationEnabled: true,
  maxSessionHistory: 100,
  dataRetentionDays: 30,
};

/**
 * Manages usage statistics and provider failure tracking.
 */
export class UsageStatsManager {
  private stats: UsageStats;
  private config: UsageStatsConfig;
  private statsFilePath: string;
  private currentSessionId: string | null = null;
  private sessionStartTime: number | null = null;

  constructor(config: Partial<UsageStatsConfig> = {}) {
    this.config = { ...DEFAULT_STATS_CONFIG, ...config };
    this.statsFilePath = config.statsFilePath || resolve(homedir(), '.arcane', 'usage-stats.json');
    this.stats = this.createDefaultStats();
  }

  /**
   * Initializes the usage stats manager and loads existing data.
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      await this.ensureStatsDirectory();
      await this.loadStats();
      await this.cleanupOldData();
    } catch (error) {
      console.warn('Failed to initialize usage stats:', error);
      // Continue with default stats if loading fails
      this.stats = this.createDefaultStats();
    }
  }

  /**
   * Starts tracking a new session.
   */
  async startSession(sessionId: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    this.currentSessionId = sessionId;
    this.sessionStartTime = Date.now();

    const sessionStats: SessionStats = {
      sessionId: this.config.anonymizationEnabled ? this.anonymizeSessionId(sessionId) : sessionId,
      startTime: this.sessionStartTime,
      commandsExecuted: 0,
      totalTokensUsed: 0,
      providersUsed: [],
      toolCallsExecuted: 0,
    };

    this.stats.sessions.push(sessionStats);
    this.stats.totalSessions++;
    await this.saveStats();
  }

  /**
   * Ends the current session.
   */
  async endSession(): Promise<void> {
    if (!this.config.enabled || !this.currentSessionId) {
      return;
    }

    const currentSession = this.getCurrentSession();
    if (currentSession) {
      currentSession.endTime = Date.now();
    }

    this.currentSessionId = null;
    this.sessionStartTime = null;
    await this.saveStats();
  }

  /**
   * Records command usage.
   */
  async recordCommand(command: string, executionTime?: number, success: boolean = true): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const commandKey = this.config.anonymizationEnabled ? this.anonymizeCommand(command) : command;
    
    if (!this.stats.commands[commandKey]) {
      this.stats.commands[commandKey] = {
        command: commandKey,
        usageCount: 0,
        successCount: 0,
        errorCount: 0,
        averageExecutionTime: 0,
      };
    }

    const commandStats = this.stats.commands[commandKey];
    commandStats.usageCount++;
    commandStats.lastUsed = Date.now();

    if (success) {
      commandStats.successCount++;
    } else {
      commandStats.errorCount++;
    }

    if (executionTime !== undefined) {
      // Update running average
      const totalTime = commandStats.averageExecutionTime * (commandStats.usageCount - 1);
      commandStats.averageExecutionTime = (totalTime + executionTime) / commandStats.usageCount;
    }

    // Update session stats
    const currentSession = this.getCurrentSession();
    if (currentSession) {
      currentSession.commandsExecuted++;
    }

    this.stats.totalCommands++;
    this.stats.lastUpdated = Date.now();
    await this.saveStats();
  }

  /**
   * Records provider usage and outcome.
   */
  async recordProviderUsage(
    providerId: string, 
    success: boolean, 
    responseTime?: number,
    tokensUsed?: number,
    failureReason?: KeyFailureReason
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const providerKey = this.config.anonymizationEnabled ? this.anonymizeProviderId(providerId) : providerId;
    
    if (!this.stats.providers[providerKey]) {
      this.stats.providers[providerKey] = {
        providerId: providerKey,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        failuresByReason: {},
        keyRotationCount: 0,
        rateLimitHits: 0,
      };
    }

    const providerStats = this.stats.providers[providerKey];
    providerStats.totalRequests++;
    providerStats.lastUsed = Date.now();

    if (success) {
      providerStats.successfulRequests++;
    } else {
      providerStats.failedRequests++;
      
      if (failureReason) {
        const reasonKey = failureReason.toString();
        providerStats.failuresByReason[reasonKey] = (providerStats.failuresByReason[reasonKey] || 0) + 1;
        
        if (failureReason === KeyFailureReason.RATE_LIMIT) {
          providerStats.rateLimitHits++;
        }
      }
    }

    if (responseTime !== undefined) {
      // Update running average
      const totalTime = providerStats.averageResponseTime * (providerStats.totalRequests - 1);
      providerStats.averageResponseTime = (totalTime + responseTime) / providerStats.totalRequests;
    }

    // Update session stats
    const currentSession = this.getCurrentSession();
    if (currentSession) {
      if (tokensUsed) {
        currentSession.totalTokensUsed += tokensUsed;
      }
      
      if (!currentSession.providersUsed.includes(providerKey)) {
        currentSession.providersUsed.push(providerKey);
      }
    }

    this.stats.lastUpdated = Date.now();
    await this.saveStats();
  }

  /**
   * Records provider key rotation.
   */
  async recordKeyRotation(providerId: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const providerKey = this.config.anonymizationEnabled ? this.anonymizeProviderId(providerId) : providerId;
    
    if (!this.stats.providers[providerKey]) {
      await this.recordProviderUsage(providerId, false); // Initialize if needed
    }

    this.stats.providers[providerKey].keyRotationCount++;
    this.stats.lastUpdated = Date.now();
    await this.saveStats();
  }

  /**
   * Records tool call execution.
   */
  async recordToolCall(toolName: string, success: boolean, executionTime?: number): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Record as a special command type
    const commandName = `tool:${toolName}`;
    await this.recordCommand(commandName, executionTime, success);

    // Update session stats
    const currentSession = this.getCurrentSession();
    if (currentSession) {
      currentSession.toolCallsExecuted++;
    }
  }

  /**
   * Gets current usage statistics.
   */
  getStats(): UsageStats {
    return { ...this.stats };
  }

  /**
   * Gets provider statistics.
   */
  getProviderStats(): Record<string, ProviderStats> {
    return { ...this.stats.providers };
  }

  /**
   * Gets command statistics.
   */
  getCommandStats(): Record<string, CommandStats> {
    return { ...this.stats.commands };
  }

  /**
   * Gets session statistics for the last N sessions.
   */
  getRecentSessions(count: number = 10): SessionStats[] {
    return this.stats.sessions.slice(-count);
  }

  /**
   * Generates a usage summary report.
   */
  generateSummaryReport(): {
    totalSessions: number;
    totalCommands: number;
    topCommands: Array<{ command: string; count: number }>;
    providerReliability: Array<{ provider: string; successRate: number; totalRequests: number }>;
    averageSessionLength: number;
    totalFailures: number;
  } {
    const topCommands = Object.values(this.stats.commands)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10)
      .map(cmd => ({ command: cmd.command, count: cmd.usageCount }));

    const providerReliability = Object.values(this.stats.providers)
      .map(provider => ({
        provider: provider.providerId,
        successRate: provider.totalRequests > 0 ? provider.successfulRequests / provider.totalRequests : 0,
        totalRequests: provider.totalRequests,
      }))
      .sort((a, b) => b.totalRequests - a.totalRequests);

    const completedSessions = this.stats.sessions.filter(s => s.endTime);
    const averageSessionLength = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + (s.endTime! - s.startTime), 0) / completedSessions.length
      : 0;

    const totalFailures = Object.values(this.stats.providers)
      .reduce((sum, provider) => sum + provider.failedRequests, 0);

    return {
      totalSessions: this.stats.totalSessions,
      totalCommands: this.stats.totalCommands,
      topCommands,
      providerReliability,
      averageSessionLength,
      totalFailures,
    };
  }

  /**
   * Enables or disables usage stats collection.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    this.config.enabled = enabled;
    this.stats.enabled = enabled;
    await this.saveStats();
  }

  /**
   * Clears all usage statistics.
   */
  async clearStats(): Promise<void> {
    this.stats = this.createDefaultStats();
    await this.saveStats();
  }

  /**
   * Exports usage statistics to a file.
   */
  async exportStats(filePath: string): Promise<void> {
    const exportData = {
      exportDate: new Date().toISOString(),
      stats: this.stats,
    };
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
  }

  private createDefaultStats(): UsageStats {
    return {
      version: '1.0.0',
      enabled: this.config.enabled,
      anonymizationEnabled: this.config.anonymizationEnabled,
      lastUpdated: Date.now(),
      totalSessions: 0,
      totalCommands: 0,
      providers: {},
      commands: {},
      sessions: [],
      installationId: this.generateInstallationId(),
    };
  }

  private async ensureStatsDirectory(): Promise<void> {
    const dir = resolve(this.statsFilePath, '..');
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private async loadStats(): Promise<void> {
    try {
      const data = await fs.readFile(this.statsFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.stats = UsageStatsSchema.parse(parsed);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.warn('Failed to load usage stats:', error);
      }
      // File doesn't exist or is invalid, use defaults
    }
  }

  private async saveStats(): Promise<void> {
    try {
      this.stats.lastUpdated = Date.now();
      await fs.writeFile(this.statsFilePath, JSON.stringify(this.stats, null, 2), 'utf-8');
    } catch (error) {
      console.warn('Failed to save usage stats:', error);
    }
  }

  private async cleanupOldData(): Promise<void> {
    const cutoffTime = Date.now() - (this.config.dataRetentionDays * 24 * 60 * 60 * 1000);
    
    // Remove old sessions
    this.stats.sessions = this.stats.sessions.filter(session => session.startTime > cutoffTime);
    
    // Limit session history
    if (this.stats.sessions.length > this.config.maxSessionHistory) {
      this.stats.sessions = this.stats.sessions.slice(-this.config.maxSessionHistory);
    }
  }

  private getCurrentSession(): SessionStats | undefined {
    if (!this.currentSessionId) {
      return undefined;
    }
    
    const anonymizedId = this.config.anonymizationEnabled 
      ? this.anonymizeSessionId(this.currentSessionId) 
      : this.currentSessionId;
    
    return this.stats.sessions.find(s => s.sessionId === anonymizedId);
  }

  private anonymizeSessionId(sessionId: string): string {
    // Create a hash-based anonymous ID
    return `session-${this.hashString(sessionId).substring(0, 8)}`;
  }

  private anonymizeCommand(command: string): string {
    // Remove any sensitive information from commands
    const parts = command.split(' ');
    const baseCommand = parts[0];
    
    // Keep only the base command and anonymize arguments
    if (parts.length > 1) {
      return `${baseCommand} <args>`;
    }
    return baseCommand;
  }

  private anonymizeProviderId(providerId: string): string {
    // Keep provider types but anonymize specific identifiers
    const knownProviders = ['gemini', 'openrouter', 'groq', 'anthropic', 'openai'];
    return knownProviders.includes(providerId.toLowerCase()) ? providerId : 'custom-provider';
  }

  private generateInstallationId(): string {
    // Generate a random anonymous installation ID
    return 'install-' + Math.random().toString(36).substring(2, 15);
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Global usage stats manager instance.
 */
let globalUsageStatsManager: UsageStatsManager | null = null;

/**
 * Gets or creates the global usage stats manager.
 */
export function getUsageStatsManager(config?: Partial<UsageStatsConfig>): UsageStatsManager {
  if (!globalUsageStatsManager) {
    globalUsageStatsManager = new UsageStatsManager(config);
  }
  return globalUsageStatsManager;
}

/**
 * Initializes the global usage stats manager.
 */
export async function initializeUsageStats(config?: Partial<UsageStatsConfig>): Promise<void> {
  const manager = getUsageStatsManager(config);
  await manager.initialize();
}
