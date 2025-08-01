/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/agents/metadata.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MetadataManager } from './metadata.js';
import { Agent, Role, Skill, SkillLevel, Priority } from './types.js';

// Mock fs to avoid actual file system operations
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
  },
}));

describe('MetadataManager', () => {
  let metadataManager: MetadataManager;
  let testDir: string;
  const mockFs = fs as any;

  beforeEach(() => {
    testDir = join(tmpdir(), 'test-metadata-' + Date.now());
    metadataManager = new MetadataManager(testDir);
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock successful directory creation
    mockFs.mkdir.mockResolvedValue(undefined);
    
    // Mock successful file writes
    mockFs.writeFile.mockResolvedValue(undefined);
    
    // Mock file reads to return empty content by default
    mockFs.readFile.mockResolvedValue('---\nname: "Test"\n---\nTest content');
    
    // Mock directory listings
    mockFs.readdir.mockResolvedValue([]);
    
    // Mock file stats
    mockFs.stat.mockResolvedValue({
      mtime: new Date(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('agent directory creation', () => {
    it('should create agent directory with meta.md and agent.md', async () => {
      const agent: Agent = {
        name: 'Test Agent',
        description: 'A test agent',
        roles: ['developer'],
        skills: ['programming'],
        tools: ['read-file'],
        enabled: true,
        priority: Priority.MEDIUM,
        created: '2025-01-01T00:00:00.000Z',
        version: '1.0.0',
        tags: ['test'],
        metadata: {},
      };

      const agentDir = await metadataManager.createAgentDirectory(agent);
      
      expect(agentDir).toContain('test-agent');
      expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('test-agent'), { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('meta.md'),
        expect.stringContaining('# Test Agent - Metadata'),
        'utf-8'
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('agent.md'),
        expect.stringContaining('# Test Agent'),
        'utf-8'
      );
    });

    it('should generate proper metadata file with YAML frontmatter', async () => {
      const agent: Agent = {
        name: 'Complex Agent',
        description: 'A complex test agent',
        personality: 'Helpful and analytical',
        instructions: 'Be thorough in analysis',
        roles: ['analyst', 'researcher'],
        skills: ['data-analysis', 'research'],
        tools: ['web-search', 'read-file'],
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        systemPrompt: 'You are a research assistant',
        enabled: true,
        priority: Priority.HIGH,
        created: '2025-01-01T00:00:00.000Z',
        version: '1.0.0',
        tags: ['research', 'analysis'],
        metadata: { customField: 'customValue' },
      };

      await metadataManager.createAgentDirectory(agent);
      
      const metaCall = mockFs.writeFile.mock.calls.find((call: any) => 
        call[0].includes('meta.md')
      );
      
      expect(metaCall).toBeTruthy();
      const metaContent = metaCall[1];
      
      // Check YAML frontmatter
      expect(metaContent).toContain('---');
      expect(metaContent).toContain('name: "Complex Agent"');
      expect(metaContent).toContain('personality: "Helpful and analytical"');
      expect(metaContent).toContain('model: "gpt-4"');
      expect(metaContent).toContain('temperature: 0.7');
      expect(metaContent).toContain('enabled: true');
      
      // Check content sections
      expect(metaContent).toContain('# Complex Agent - Metadata');
      expect(metaContent).toContain('## Description');
      expect(metaContent).toContain('## Configuration Notes');
      expect(metaContent).toContain('## Metadata Fields');
    });
  });

  describe('role directory creation', () => {
    it('should create role directory with proper structure', async () => {
      const role: Role = {
        name: 'Test Role',
        description: 'A test role',
        responsibilities: ['Test software', 'Write reports'],
        requiredSkills: ['testing'],
        optionalSkills: ['automation'],
        permissions: ['read-files', 'write-reports'],
        restrictions: ['no-production-access'],
        priority: Priority.MEDIUM,
        created: '2025-01-01T00:00:00.000Z',
        version: '1.0.0',
        tags: ['testing'],
      };

      const roleDir = await metadataManager.createRoleDirectory(role);
      
      expect(roleDir).toContain('test-role');
      expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('test-role'), { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('meta.md'),
        expect.stringContaining('# Test Role - Role Metadata'),
        'utf-8'
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('role.md'),
        expect.stringContaining('# Test Role'),
        'utf-8'
      );
    });
  });

  describe('skill directory creation', () => {
    it('should create skill directory with proper structure', async () => {
      const skill: Skill = {
        name: 'Test Skill',
        description: 'A test skill',
        level: SkillLevel.INTERMEDIATE,
        category: 'Testing',
        prerequisites: ['basic-programming'],
        tools: ['jest', 'vitest'],
        examples: ['Write unit tests', 'Create integration tests'],
        restrictions: ['no-production-testing'],
        created: '2025-01-01T00:00:00.000Z',
        version: '1.0.0',
        tags: ['testing', 'qa'],
      };

      const skillDir = await metadataManager.createSkillDirectory(skill);
      
      expect(skillDir).toContain('test-skill');
      expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('test-skill'), { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('meta.md'),
        expect.stringContaining('# Test Skill - Skill Metadata'),
        'utf-8'
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('skill.md'),
        expect.stringContaining('# Test Skill'),
        'utf-8'
      );
    });
  });

  describe('metadata loading', () => {
    it('should load agent metadata from meta.md file', async () => {
      const mockMetaContent = `---
name: "Loaded Agent"
description: "An agent loaded from metadata"
personality: "Friendly"
roles: ["helper"]
skills: ["communication"]
tools: ["chat"]
enabled: true
priority: "medium"
created: "2025-01-01T00:00:00.000Z"
version: "1.0.0"
tags: ["loaded"]
metadata: {}
---

# Loaded Agent - Metadata

This is a test metadata file.`;

      mockFs.readFile.mockResolvedValueOnce(mockMetaContent);

      const agent = await metadataManager.loadAgentMetadata('Loaded Agent');
      
      expect(agent).toBeTruthy();
      expect(agent?.name).toBe('Loaded Agent');
      expect(agent?.description).toBe('An agent loaded from metadata');
      expect(agent?.personality).toBe('Friendly');
      expect(agent?.roles).toEqual(['helper']);
      expect(agent?.skills).toEqual(['communication']);
      expect(agent?.enabled).toBe(true);
    });

    it('should return null for non-existent agent', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('File not found'));

      const agent = await metadataManager.loadAgentMetadata('Non-existent Agent');
      
      expect(agent).toBeNull();
    });

    it('should handle malformed metadata gracefully', async () => {
      const malformedContent = `---
invalid yaml content
---
Test content`;

      mockFs.readFile.mockResolvedValueOnce(malformedContent);

      const agent = await metadataManager.loadAgentMetadata('Malformed Agent');
      
      expect(agent).toBeNull();
    });
  });

  describe('metadata updating', () => {
    it('should update agent metadata file with new timestamp', async () => {
      const agent: Agent = {
        name: 'Updated Agent',
        description: 'An updated agent',
        roles: [],
        skills: [],
        tools: [],
        enabled: true,
        priority: Priority.MEDIUM,
        created: '2025-01-01T00:00:00.000Z',
        version: '1.0.0',
        tags: [],
        metadata: {},
      };

      await metadataManager.updateAgentMetadata('Updated Agent', agent);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('updated-agent/meta.md'),
        expect.stringContaining('# Updated Agent - Metadata'),
        'utf-8'
      );

      // Check that updated timestamp was added
      expect(agent.updated).toBeTruthy();
      expect(new Date(agent.updated!).getTime()).toBeGreaterThan(new Date(agent.created).getTime());
    });
  });

  describe('metadata file listing', () => {
    it('should list all agent metadata files', async () => {
      const mockDirEntries = [
        { name: 'agent1', isDirectory: () => true },
        { name: 'agent2', isDirectory: () => true },
        { name: 'not-a-dir.txt', isDirectory: () => false },
      ];

      const mockMetaContent1 = `---
name: "Agent 1"
description: "First agent"
---
Content 1`;

      const mockMetaContent2 = `---
name: "Agent 2"
description: "Second agent"
---
Content 2`;

      mockFs.readdir.mockResolvedValueOnce(mockDirEntries);
      mockFs.readFile
        .mockResolvedValueOnce(mockMetaContent1)
        .mockResolvedValueOnce(mockMetaContent2);

      const metadataFiles = await metadataManager.listMetadataFiles('agents');
      
      expect(metadataFiles).toHaveLength(2);
      expect(metadataFiles[0].frontmatter.name).toBe('Agent 1');
      expect(metadataFiles[1].frontmatter.name).toBe('Agent 2');
    });

    it('should handle directories without meta.md files', async () => {
      const mockDirEntries = [
        { name: 'incomplete-agent', isDirectory: () => true },
      ];

      mockFs.readdir.mockResolvedValueOnce(mockDirEntries);
      mockFs.readFile.mockRejectedValueOnce(new Error('File not found'));

      const metadataFiles = await metadataManager.listMetadataFiles('agents');
      
      expect(metadataFiles).toHaveLength(0);
    });
  });

  describe('ecosystem rebuilding', () => {
    it('should rebuild ecosystem from metadata files', async () => {
      // Mock agent directory
      const mockAgentDirEntries = [
        { name: 'test-agent', isDirectory: () => true },
      ];
      const mockAgentContent = `---
name: "Test Agent"
description: "A test agent"
roles: []
skills: []
tools: []
enabled: true
priority: "medium"
created: "2025-01-01T00:00:00.000Z"
version: "1.0.0"
tags: []
metadata: {}
---
Content`;

      // Mock role directory
      const mockRoleDirEntries = [
        { name: 'test-role', isDirectory: () => true },
      ];
      const mockRoleContent = `---
name: "Test Role"
description: "A test role"
responsibilities: []
requiredSkills: []
optionalSkills: []
permissions: []
restrictions: []
priority: "medium"
created: "2025-01-01T00:00:00.000Z"
version: "1.0.0"
tags: []
---
Content`;

      // Mock skill directory
      const mockSkillDirEntries = [
        { name: 'test-skill', isDirectory: () => true },
      ];
      const mockSkillContent = `---
name: "Test Skill"
description: "A test skill"
level: "beginner"
prerequisites: []
tools: []
examples: []
restrictions: []
created: "2025-01-01T00:00:00.000Z"
version: "1.0.0"
tags: []
---
Content`;

      mockFs.readdir
        .mockResolvedValueOnce(mockAgentDirEntries) // agents
        .mockResolvedValueOnce(mockRoleDirEntries)  // roles
        .mockResolvedValueOnce(mockSkillDirEntries); // skills

      mockFs.readFile
        .mockResolvedValueOnce(mockAgentContent)
        .mockResolvedValueOnce(mockRoleContent)
        .mockResolvedValueOnce(mockSkillContent);

      const ecosystem = await metadataManager.rebuildEcosystemFromMetadata();
      
      expect(ecosystem.agents).toHaveProperty('Test Agent');
      expect(ecosystem.roles).toHaveProperty('Test Role');
      expect(ecosystem.skills).toHaveProperty('Test Skill');
      expect(ecosystem.version).toBe('1.0.0');
      expect(ecosystem.lastUpdated).toBeTruthy();
    });
  });

  describe('frontmatter parsing', () => {
    it('should parse simple YAML frontmatter correctly', async () => {
      const content = `---
name: "Test"
description: "A test item"
enabled: true
count: 42
list: ["item1", "item2"]
---

Body content here`;

      // Call the private method through reflection for testing
      const result = (metadataManager as any).parseFrontmatter(content);
      
      expect(result.frontmatter.name).toBe('Test');
      expect(result.frontmatter.description).toBe('A test item');
      expect(result.frontmatter.enabled).toBe(true);
      expect(result.frontmatter.count).toBe(42);
      expect(result.body.trim()).toBe('Body content here');
    });

    it('should handle content without frontmatter', async () => {
      const content = 'Just plain content without frontmatter';

      const result = (metadataManager as any).parseFrontmatter(content);
      
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe(content);
    });
  });

  describe('YAML generation', () => {
    it('should generate proper YAML from objects', async () => {
      const obj = {
        name: 'Test',
        count: 42,
        enabled: true,
        list: ['item1', 'item2'],
        nested: {
          key: 'value',
        },
      };

      const yaml = (metadataManager as any).objectToYaml(obj);
      
      expect(yaml).toContain('name: "Test"');
      expect(yaml).toContain('count: 42');
      expect(yaml).toContain('enabled: true');
      expect(yaml).toContain('list:');
      expect(yaml).toContain('- "item1"');
      expect(yaml).toContain('- "item2"');
      expect(yaml).toContain('nested:');
      expect(yaml).toContain('  key: "value"');
    });

    it('should handle empty arrays and undefined values', async () => {
      const obj = {
        emptyArray: [],
        undefinedValue: undefined,
        nullValue: null,
        validValue: 'test',
      };

      const yaml = (metadataManager as any).objectToYaml(obj);
      
      expect(yaml).toContain('emptyArray: []');
      expect(yaml).toContain('validValue: "test"');
      expect(yaml).not.toContain('undefinedValue');
      expect(yaml).not.toContain('nullValue');
    });
  });
});
