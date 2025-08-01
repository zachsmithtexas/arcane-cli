/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/telemetry/usageStats.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import {
  UsageStatsManager,
  getUsageStatsManager,
  initializeUsageStats,
  DEFAULT_STATS_CONFIG,
} from './usageStats.js';
import { KeyFailureReason } from '../providers/keys.js';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

const mockFs = fs as any;

describe('UsageStatsManager', () => {
  let manager: UsageStatsManager;
  let tempStatsPath: string;

  beforeEach(() => {
    tempStatsPath = resolve(tmpdir(), `usage-stats-test-${Date.now()}.json`);
    manager = new UsageStatsManager({
      enabled: true,
      statsFilePath: tempStatsPath,
    });
    
    // Reset mocks
    vi.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default stats when no file exists', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      await manager.initialize();
      
      const stats = manager.getStats();
      expect(stats.version).toBe('1.0.0');
      expect(stats.enabled).toBe(true);
      expect(stats.totalSessions).toBe(0);
      expect(stats.totalCommands).toBe(0);
    });

    it('should load existing stats from file', async () => {
      const existingStats = {
        version: '1.0.0',
        enabled: true,
        anonymizationEnabled: true,
        lastUpdated: Date.now(),
        totalSessions: 5,
        totalCommands: 50,
        providers: {},
        commands: {},
        sessions: [],
      };
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingStats));
      
      await manager.initialize();
      
      const stats = manager.getStats();
      expect(stats.totalSessions).toBe(5);
      expect(stats.totalCommands).toBe(50);
    });

    it('should handle invalid JSON gracefully', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');
      
      await manager.initialize();
      
      const stats = manager.getStats();
      expect(stats.totalSessions).toBe(0); // Should use defaults
    });
  });

  describe('session tracking', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      await manager.initialize();
    });

    it('should start and track sessions', async () => {
      await manager.startSession('test-session-1');
      
      const stats = manager.getStats();
      expect(stats.totalSessions).toBe(1);
      expect(stats.sessions).toHaveLength(1);
      expect(stats.sessions[0].sessionId).toContain('session-'); // Anonymized
      expect(stats.sessions[0].startTime).toBeDefined();
    });

    it('should end sessions correctly', async () => {
      await manager.startSession('test-session-1');
      await manager.endSession();
      
      const stats = manager.getStats();
      const session = stats.sessions[0];
      expect(session.endTime).toBeDefined();
    });

    it('should track multiple sessions', async () => {
      await manager.startSession('session-1');
      await manager.endSession();
      
      await manager.startSession('session-2');
      await manager.endSession();
      
      const stats = manager.getStats();
      expect(stats.totalSessions).toBe(2);
      expect(stats.sessions).toHaveLength(2);
    });
  });

  describe('command tracking', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      await manager.initialize();
      await manager.startSession('test-session');
    });

    it('should record command usage', async () => {
      await manager.recordCommand('chat', 1500, true);
      
      const commandStats = manager.getCommandStats();
      expect(commandStats['chat']).toBeDefined();
      expect(commandStats['chat'].usageCount).toBe(1);
      expect(commandStats['chat'].successCount).toBe(1);
      expect(commandStats['chat'].errorCount).toBe(0);
      expect(commandStats['chat'].averageExecutionTime).toBe(1500);
    });

    it('should track command failures', async () => {
      await manager.recordCommand('chat', 1000, false);
      
      const commandStats = manager.getCommandStats();
      expect(commandStats['chat'].errorCount).toBe(1);
      expect(commandStats['chat'].successCount).toBe(0);
    });

    it('should update running averages for execution time', async () => {
      await manager.recordCommand('chat', 1000, true);
      await manager.recordCommand('chat', 2000, true);
      
      const commandStats = manager.getCommandStats();
      expect(commandStats['chat'].usageCount).toBe(2);
      expect(commandStats['chat'].averageExecutionTime).toBe(1500);
    });

    it('should anonymize commands when enabled', async () => {
      const managerWithAnonymization = new UsageStatsManager({
        enabled: true,
        anonymizationEnabled: true,
        statsFilePath: tempStatsPath,
      });
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      await managerWithAnonymization.initialize();
      
      await managerWithAnonymization.recordCommand('chat --prompt "sensitive data"', 1000, true);
      
      const commandStats = managerWithAnonymization.getCommandStats();
      expect(commandStats['chat <args>']).toBeDefined();
      expect(commandStats['chat --prompt "sensitive data"']).toBeUndefined();
    });
  });

  describe('provider tracking', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      await manager.initialize();
      await manager.startSession('test-session');
    });

    it('should record successful provider usage', async () => {
      await manager.recordProviderUsage('gemini', true, 2000, 100);
      
      const providerStats = manager.getProviderStats();
      expect(providerStats['gemini']).toBeDefined();
      expect(providerStats['gemini'].totalRequests).toBe(1);
      expect(providerStats['gemini'].successfulRequests).toBe(1);
      expect(providerStats['gemini'].failedRequests).toBe(0);
      expect(providerStats['gemini'].averageResponseTime).toBe(2000);
    });

    it('should record provider failures with reasons', async () => {
      await manager.recordProviderUsage('gemini', false, 1000, 0, KeyFailureReason.RATE_LIMIT);
      
      const providerStats = manager.getProviderStats();
      expect(providerStats['gemini'].failedRequests).toBe(1);
      expect(providerStats['gemini'].rateLimitHits).toBe(1);
      expect(providerStats['gemini'].failuresByReason['rate_limit']).toBe(1);
    });

    it('should track key rotations', async () => {
      await manager.recordKeyRotation('gemini');
      
      const providerStats = manager.getProviderStats();
      expect(providerStats['gemini'].keyRotationCount).toBe(1);
    });

    it('should update session stats with provider usage', async () => {
      await manager.recordProviderUsage('gemini', true, 2000, 100);
      
      const stats = manager.getStats();
      const currentSession = stats.sessions[0];
      expect(currentSession.totalTokensUsed).toBe(100);
      expect(currentSession.providersUsed).toContain('gemini');
    });

    it('should calculate running averages for response time', async () => {
      await manager.recordProviderUsage('gemini', true, 1000);
      await manager.recordProviderUsage('gemini', true, 3000);
      
      const providerStats = manager.getProviderStats();
      expect(providerStats['gemini'].averageResponseTime).toBe(2000);
      expect(providerStats['gemini'].totalRequests).toBe(2);
    });

    it('should anonymize custom provider IDs', async () => {
      const managerWithAnonymization = new UsageStatsManager({
        enabled: true,
        anonymizationEnabled: true,
        statsFilePath: tempStatsPath,
      });
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      await managerWithAnonymization.initialize();
      
      await managerWithAnonymization.recordProviderUsage('my-custom-provider-123', true);
      
      const providerStats = managerWithAnonymization.getProviderStats();
      expect(providerStats['custom-provider']).toBeDefined();
      expect(providerStats['my-custom-provider-123']).toBeUndefined();
    });
  });

  describe('tool call tracking', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      await manager.initialize();
      await manager.startSession('test-session');
    });

    it('should record tool call usage', async () => {
      await manager.recordToolCall('read-file', true, 500);
      
      const commandStats = manager.getCommandStats();
      expect(commandStats['tool:read-file']).toBeDefined();
      expect(commandStats['tool:read-file'].usageCount).toBe(1);
      expect(commandStats['tool:read-file'].successCount).toBe(1);
      
      const stats = manager.getStats();
      const currentSession = stats.sessions[0];
      expect(currentSession.toolCallsExecuted).toBe(1);
    });

    it('should track tool call failures', async () => {
      await manager.recordToolCall('write-file', false, 1000);
      
      const commandStats = manager.getCommandStats();
      expect(commandStats['tool:write-file'].errorCount).toBe(1);
    });
  });

  describe('statistics and reporting', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      await manager.initialize();
      await manager.startSession('test-session');
    });

    it('should generate summary reports', async () => {
      // Add some test data
      await manager.recordCommand('chat', 1000, true);
      await manager.recordCommand('chat', 1500, true);
      await manager.recordCommand('help', 500, true);
      await manager.recordProviderUsage('gemini', true, 2000);
      await manager.recordProviderUsage('gemini', false, 1000, 0, KeyFailureReason.RATE_LIMIT);
      
      const report = manager.generateSummaryReport();
      
      expect(report.totalCommands).toBe(3);
      expect(report.topCommands).toHaveLength(2);
      expect(report.topCommands[0].command).toBe('chat');
      expect(report.topCommands[0].count).toBe(2);
      
      expect(report.providerReliability).toHaveLength(1);
      expect(report.providerReliability[0].provider).toBe('gemini');
      expect(report.providerReliability[0].successRate).toBe(0.5);
      expect(report.providerReliability[0].totalRequests).toBe(2);
      
      expect(report.totalFailures).toBe(1);
    });

    it('should get recent sessions', async () => {
      await manager.endSession();
      
      // Start another session
      await manager.startSession('session-2');
      await manager.endSession();
      
      const recentSessions = manager.getRecentSessions(5);
      expect(recentSessions).toHaveLength(2);
    });
  });

  describe('configuration management', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      await manager.initialize();
    });

    it('should respect enabled/disabled setting', async () => {
      await manager.setEnabled(false);
      await manager.recordCommand('chat', 1000, true);
      
      const commandStats = manager.getCommandStats();
      expect(Object.keys(commandStats)).toHaveLength(0);
    });

    it('should not track when disabled from start', async () => {
      const disabledManager = new UsageStatsManager({
        enabled: false,
        statsFilePath: tempStatsPath,
      });
      
      await disabledManager.initialize();
      await disabledManager.recordCommand('chat', 1000, true);
      
      const commandStats = disabledManager.getCommandStats();
      expect(Object.keys(commandStats)).toHaveLength(0);
    });

    it('should clear statistics', async () => {
      await manager.recordCommand('chat', 1000, true);
      await manager.clearStats();
      
      const stats = manager.getStats();
      expect(stats.totalCommands).toBe(0);
      expect(Object.keys(stats.commands)).toHaveLength(0);
    });
  });

  describe('data persistence', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      await manager.initialize();
    });

    it('should save stats after recording data', async () => {
      await manager.recordCommand('chat', 1000, true);
      
      expect(mockFs.writeFile).toHaveBeenCalled();
      const writeCall = mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1];
      expect(writeCall[0]).toBe(tempStatsPath);
      
      const savedData = JSON.parse(writeCall[1]);
      expect(savedData.totalCommands).toBe(1);
    });

    it('should export statistics to file', async () => {
      const exportPath = resolve(tmpdir(), 'export-test.json');
      await manager.recordCommand('chat', 1000, true);
      
      await manager.exportStats(exportPath);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        exportPath,
        expect.stringContaining('"exportDate"'),
        'utf-8'
      );
    });

    it('should handle save errors gracefully', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));
      
      // Should not throw
      await expect(manager.recordCommand('chat', 1000, true)).resolves.not.toThrow();
    });
  });

  describe('data cleanup', () => {
    it('should limit session history', async () => {
      const managerWithLimitedHistory = new UsageStatsManager({
        enabled: true,
        maxSessionHistory: 2,
        statsFilePath: tempStatsPath,
      });
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      await managerWithLimitedHistory.initialize();
      
      // Add 3 sessions
      await managerWithLimitedHistory.startSession('session-1');
      await managerWithLimitedHistory.endSession();
      
      await managerWithLimitedHistory.startSession('session-2');
      await managerWithLimitedHistory.endSession();
      
      await managerWithLimitedHistory.startSession('session-3');
      await managerWithLimitedHistory.endSession();
      
      // Trigger cleanup by initializing again
      await managerWithLimitedHistory.initialize();
      
      const sessions = managerWithLimitedHistory.getRecentSessions(10);
      expect(sessions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('anonymization', () => {
    let anonymizedManager: UsageStatsManager;

    beforeEach(async () => {
      anonymizedManager = new UsageStatsManager({
        enabled: true,
        anonymizationEnabled: true,
        statsFilePath: tempStatsPath,
      });
      
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      await anonymizedManager.initialize();
    });

    it('should anonymize session IDs', async () => {
      await anonymizedManager.startSession('very-specific-session-id-12345');
      
      const stats = anonymizedManager.getStats();
      expect(stats.sessions[0].sessionId).not.toContain('very-specific-session-id-12345');
      expect(stats.sessions[0].sessionId).toMatch(/^session-[a-z0-9]+$/);
    });

    it('should preserve known provider names', async () => {
      await anonymizedManager.recordProviderUsage('gemini', true);
      await anonymizedManager.recordProviderUsage('openai', true);
      
      const providerStats = anonymizedManager.getProviderStats();
      expect(providerStats['gemini']).toBeDefined();
      expect(providerStats['openai']).toBeDefined();
    });

    it('should anonymize unknown provider names', async () => {
      await anonymizedManager.recordProviderUsage('my-secret-provider-v2', true);
      
      const providerStats = anonymizedManager.getProviderStats();
      expect(providerStats['custom-provider']).toBeDefined();
      expect(providerStats['my-secret-provider-v2']).toBeUndefined();
    });
  });
});

describe('Global usage stats manager', () => {
  it('should return the same instance', () => {
    const manager1 = getUsageStatsManager();
    const manager2 = getUsageStatsManager();
    
    expect(manager1).toBe(manager2);
  });

  it('should initialize global instance', async () => {
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    
    await initializeUsageStats({ enabled: true });
    
    const manager = getUsageStatsManager();
    expect(manager).toBeDefined();
  });
});
