/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vitest/globals" />

// packages/core/src/agents/manager.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { AgentManager } from './manager.js';
import { MetadataManager } from './metadata.js';
import {
  GenerationTemplate,
  Agent,
  Role,
  Skill,
  AgentEcosystem,
  SkillLevel,
  Priority,
} from './types.js';

describe('AgentManager', () => {
  vi.mock('./metadata.js');
  let manager: AgentManager;
  let testDir: string;
  let mockMetadataManager: vi.Mocked<MetadataManager>;

  const mockEcosystem: AgentEcosystem = {
    agents: {
      'Developer Bot': {
        name: 'Developer Bot',
        description: 'A bot that helps with coding tasks',
        tags: ['coding', 'development'],
        roles: [],
        skills: [],
        tools: [],
        enabled: true,
        priority: Priority.MEDIUM,
        created: '2025-01-01T00:00:00.000Z',
        version: '1.0.0',
        metadata: {},
      },
      'Analyst AI': {
        name: 'Analyst AI',
        description: 'An AI for data analysis and reporting',
        tags: ['data', 'analysis'],
        roles: [],
        skills: [],
        tools: [],
        enabled: true,
        priority: Priority.MEDIUM,
        created: '2025-01-01T00:00:00.000Z',
        version: '1.0.0',
        metadata: {},
      },
    },
    roles: {
      'Code Reviewer': {
        name: 'Code Reviewer',
        description: 'Reviews code for quality and security',
        tags: ['code', 'security'],
        responsibilities: [],
        requiredSkills: [],
        optionalSkills: [],
        permissions: [],
        restrictions: [],
        priority: Priority.MEDIUM,
        created: '2025-01-01T00:00:00.000Z',
        version: '1.0.0',
      },
    },
    skills: {
      JavaScript: {
        name: 'JavaScript',
        description: 'Programming in JavaScript language',
        category: 'Programming',
        tags: ['programming', 'web'],
        level: SkillLevel.INTERMEDIATE,
        prerequisites: [],
        tools: [],
        examples: [],
        restrictions: [],
        created: '2025-01-01T00:00:00.000Z',
        version: '1.0.0',
      },
    },
    version: '1.0.0',
    lastUpdated: '2025-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    testDir = join(tmpdir(), 'test-arcane-' + Date.now());
    manager = new AgentManager(testDir);

    // Get the mocked instance of MetadataManager
    mockMetadataManager = vi.mocked(MetadataManager).mock.instances[0];

    // Default mock implementations
    mockMetadataManager.rebuildEcosystemFromMetadata.mockResolvedValue(
      mockEcosystem,
    );
    mockMetadataManager.createAgentDirectory.mockImplementation(
      async (agent: Agent) =>
        join(testDir, 'agents', agent.name.toLowerCase().replace(/\s+/g, '-')),
    );
    mockMetadataManager.createRoleDirectory.mockImplementation(
      async (role: Role) =>
        join(testDir, 'roles', role.name.toLowerCase().replace(/\s+/g, '-')),
    );
    mockMetadataManager.createSkillDirectory.mockImplementation(
      async (skill: Skill) =>
        join(testDir, 'skills', skill.name.toLowerCase().replace(/\s+/g, '-')),
    );
    mockMetadataManager.listMetadataFiles.mockImplementation(
      async (type: 'agents' | 'roles' | 'skills') => {
        if (type === 'agents') {
          return Object.values(mockEcosystem.agents).map((agent) => ({
            path: join(
              testDir,
              'agents',
              agent.name.toLowerCase().replace(/\s+/g, '-'),
              'meta.md',
            ),
            frontmatter: { name: agent.name },
            content: '',
            lastModified: new Date().toISOString(),
          }));
        }
        if (type === 'roles') {
          return Object.values(mockEcosystem.roles).map((role) => ({
            path: join(
              testDir,
              'roles',
              role.name.toLowerCase().replace(/\s+/g, '-'),
              'meta.md',
            ),
            frontmatter: { name: role.name },
            content: '',
            lastModified: new Date().toISOString(),
          }));
        }
        if (type === 'skills') {
          return Object.values(mockEcosystem.skills).map((skill) => ({
            path: join(
              testDir,
              'skills',
              skill.name.toLowerCase().replace(/\s+/g, '-'),
              'meta.md',
            ),
            frontmatter: { name: skill.name },
            content: '',
            lastModified: new Date().toISOString(),
          }));
        }
        return [];
      },
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully and load the ecosystem from metadata', async () => {
      await manager.initialize();
      expect(
        mockMetadataManager.rebuildEcosystemFromMetadata,
      ).toHaveBeenCalled();
      const agent = await manager.getAgent('Developer Bot');
      expect(agent).toBeTruthy();
      expect(agent?.name).toBe('Developer Bot');
    });
  });

  describe('agent creation', () => {
    it('should create a new agent successfully', async () => {
      const template: GenerationTemplate = {
        type: 'agent',
        name: 'New Agent',
        description: 'A brand new agent',
        tags: ['new'],
      };
      await manager.initialize();
      const agentDir = await manager.createAgent(template, {
        interactive: false,
      });

      expect(mockMetadataManager.createAgentDirectory).toHaveBeenCalled();
      expect(agentDir).toContain('new-agent');
      // Check if ecosystem is refreshed
      expect(
        mockMetadataManager.rebuildEcosystemFromMetadata,
      ).toHaveBeenCalledTimes(2);
    });

    it('should not create agent on dry run', async () => {
      const template: GenerationTemplate = {
        type: 'agent',
        name: 'Dry Run Agent',
        description: 'A test agent',
        tags: [],
      };
      await manager.initialize();
      await manager.createAgent(template, { interactive: false, dryRun: true });
      expect(mockMetadataManager.createAgentDirectory).not.toHaveBeenCalled();
    });
  });

  describe('search functionality', () => {
    it('should search across all types', async () => {
      await manager.initialize();
      const results = await manager.search('code');
      expect(results.length).toBe(2);
      expect(results.some((r) => r.name === 'Developer Bot')).toBe(true);
      expect(results.some((r) => r.name === 'Code Reviewer')).toBe(true);
    });

    it('should search a specific type', async () => {
      await manager.initialize();
      const results = await manager.search('data', 'agent');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Analyst AI');
    });
  });

  describe('list functionality', () => {
    it('should list all items when no type is specified', async () => {
      await manager.initialize();
      const results = await manager.list();
      expect(results.length).toBe(4); // 2 agents, 1 role, 1 skill
    });

    it('should list only agents', async () => {
      await manager.initialize();
      const results = await manager.list('agent');
      expect(results.length).toBe(2);
      expect(results.every((r) => r.type === 'agent')).toBe(true);
    });
  });

  describe('get functionality', () => {
    it('should get an agent by name', async () => {
      await manager.initialize();
      const agent = await manager.getAgent('Developer Bot');
      expect(agent).toBeTruthy();
      expect(agent?.name).toBe('Developer Bot');
    });

    it('should return null for a non-existent agent', async () => {
      await manager.initialize();
      const agent = await manager.getAgent('Non Existent');
      expect(agent).toBeNull();
    });
  });
});
