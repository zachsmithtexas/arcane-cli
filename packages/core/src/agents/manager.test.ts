/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/agents/manager.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AgentManager } from './manager.js';
import { 
  GenerationTemplate, 
  GenerationOptions, 
  SkillLevel, 
  Priority 
} from './types.js';

// Mock fs to avoid actual file system operations
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
  },
}));

describe('AgentManager', () => {
  let manager: AgentManager;
  let testDir: string;
  const mockFs = fs as any;

  beforeEach(async () => {
    testDir = join(tmpdir(), 'test-arcane-' + Date.now());
    manager = new AgentManager(testDir);
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock successful directory creation
    mockFs.mkdir.mockResolvedValue(undefined);
    
    // Mock empty ecosystem file (file doesn't exist)
    mockFs.readFile.mockRejectedValue(new Error('ENOENT'));
    
    // Mock successful file writes
    mockFs.writeFile.mockResolvedValue(undefined);
    
    // Mock file access check (file doesn't exist)
    mockFs.access.mockRejectedValue(new Error('ENOENT'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully and create directories', async () => {
      await manager.initialize();
      
      expect(mockFs.mkdir).toHaveBeenCalledWith(testDir, { recursive: true });
      expect(mockFs.mkdir).toHaveBeenCalledWith(join(testDir, 'agents'), { recursive: true });
      expect(mockFs.mkdir).toHaveBeenCalledWith(join(testDir, 'roles'), { recursive: true });
      expect(mockFs.mkdir).toHaveBeenCalledWith(join(testDir, 'skills'), { recursive: true });
    });

    it('should handle existing directories gracefully', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Directory exists'));
      
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should load existing ecosystem file', async () => {
      const existingEcosystem = {
        agents: { 
          'test-agent': { 
            name: 'Test Agent', 
            description: 'Test',
            roles: [],
            skills: [],
            tools: [],
            enabled: true,
            priority: 'medium',
            created: '2025-01-01T00:00:00.000Z',
            version: '1.0.0',
            tags: [],
            metadata: {},
          } 
        },
        roles: {},
        skills: {},
        version: '1.0.0',
        lastUpdated: '2025-01-01T00:00:00.000Z',
      };
      
      // Create a fresh manager for this test
      const testManager = new AgentManager(testDir + '-ecosystem-test');
      mockFs.readFile.mockImplementationOnce(() => Promise.resolve(JSON.stringify(existingEcosystem)));
      
      await testManager.initialize();
      
      const agent = await testManager.getAgent('test-agent');
      expect(agent).toBeTruthy();
      expect(agent?.name).toBe('Test Agent');
    });
  });

  describe('agent creation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should create a new agent successfully', async () => {
      const template: GenerationTemplate = {
        type: 'agent',
        name: 'Test Agent',
        description: 'A test agent for unit testing',
        tags: ['test', 'automation'],
        additionalFields: {
          personality: 'Helpful and efficient',
          priority: Priority.MEDIUM,
        },
      };

      const options: GenerationOptions = {
        interactive: false,
        dryRun: false,
        overwrite: false,
      };

      const filePath = await manager.createAgent(template, options);
      
      expect(filePath).toContain('test-agent.md');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-agent.md'),
        expect.stringContaining('# Test Agent'),
        'utf-8'
      );
    });

    it('should validate agent data', async () => {
      const invalidTemplate: GenerationTemplate = {
        type: 'agent',
        name: '', // Invalid: empty name
        description: 'A test agent',
        tags: [],
      };

      const options: GenerationOptions = {
        interactive: false,
      };

      await expect(manager.createAgent(invalidTemplate, options)).rejects.toThrow('validation failed');
    });

    it('should handle dry run mode', async () => {
      const template: GenerationTemplate = {
        type: 'agent',
        name: 'Dry Run Agent',
        description: 'Test dry run',
        tags: [],
      };

      const options: GenerationOptions = {
        interactive: false,
        dryRun: true,
      };

      const filePath = await manager.createAgent(template, options);
      
      expect(filePath).toContain('dry-run-agent.md');
      // In dry run mode, the markdown file is not written, but ecosystem might still be updated
      // Let's check that the actual markdown file write was not called
      const markdownCalls = mockFs.writeFile.mock.calls.filter((call: any) => 
        call[0].includes('.md')
      );
      expect(markdownCalls).toHaveLength(0);
    });

    it('should prevent overwriting existing files without overwrite flag', async () => {
      mockFs.access.mockResolvedValueOnce(undefined); // File exists
      
      const template: GenerationTemplate = {
        type: 'agent',
        name: 'Existing Agent',
        description: 'This agent already exists',
        tags: [],
      };

      const options: GenerationOptions = {
        interactive: false,
        overwrite: false,
      };

      await expect(manager.createAgent(template, options)).rejects.toThrow('already exists');
    });
  });

  describe('role creation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should create a new role successfully', async () => {
      const template: GenerationTemplate = {
        type: 'role',
        name: 'Test Role',
        description: 'A test role for unit testing',
        tags: ['testing'],
        additionalFields: {
          responsibilities: ['Test software', 'Write test cases'],
          requiredSkills: ['testing', 'automation'],
          priority: Priority.HIGH,
        },
      };

      const options: GenerationOptions = {
        interactive: false,
      };

      const filePath = await manager.createRole(template, options);
      
      expect(filePath).toContain('test-role.md');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-role.md'),
        expect.stringContaining('# Test Role'),
        'utf-8'
      );
    });

    it('should validate role data', async () => {
      const invalidTemplate: GenerationTemplate = {
        type: 'role',
        name: 'A', // Invalid: too short (less than 2 chars)
        description: 'Test',
        tags: [],
      };

      const options: GenerationOptions = {
        interactive: false,
      };

      await expect(manager.createRole(invalidTemplate, options)).rejects.toThrow('validation failed');
    });
  });

  describe('skill creation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should create a new skill successfully', async () => {
      const template: GenerationTemplate = {
        type: 'skill',
        name: 'Test Skill',
        description: 'A test skill for unit testing',
        category: 'Testing',
        tags: ['automation', 'qa'],
        additionalFields: {
          level: SkillLevel.INTERMEDIATE,
          prerequisites: ['basic-programming'],
          tools: ['jest', 'vitest'],
          examples: ['Write unit tests', 'Create integration tests'],
        },
      };

      const options: GenerationOptions = {
        interactive: false,
      };

      const filePath = await manager.createSkill(template, options);
      
      expect(filePath).toContain('test-skill.md');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-skill.md'),
        expect.stringContaining('# Test Skill'),
        'utf-8'
      );
    });

    it('should validate skill data', async () => {
      const invalidTemplate: GenerationTemplate = {
        type: 'skill',
        name: '', // Invalid: empty name
        description: 'Test skill',
        tags: [],
      };

      const options: GenerationOptions = {
        interactive: false,
      };

      await expect(manager.createSkill(invalidTemplate, options)).rejects.toThrow('validation failed');
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      // Mock ecosystem with test data
      const ecosystem = {
        agents: {
          'developer-bot': {
            name: 'Developer Bot',
            description: 'A bot that helps with coding tasks',
            tags: ['coding', 'development'],
            roles: [],
            skills: [],
            tools: [],
            enabled: true,
            priority: 'medium',
            created: '2025-01-01T00:00:00.000Z',
            version: '1.0.0',
            metadata: {},
          },
          'analyst-ai': {
            name: 'Analyst AI',
            description: 'An AI for data analysis and reporting',
            tags: ['data', 'analysis'],
            roles: [],
            skills: [],
            tools: [],
            enabled: true,
            priority: 'medium',
            created: '2025-01-01T00:00:00.000Z',
            version: '1.0.0',
            metadata: {},
          },
        },
        roles: {
          'code-reviewer': {
            name: 'Code Reviewer',
            description: 'Reviews code for quality and security',
            tags: ['code', 'security'],
            responsibilities: [],
            requiredSkills: [],
            optionalSkills: [],
            permissions: [],
            restrictions: [],
            priority: 'medium',
            created: '2025-01-01T00:00:00.000Z',
            version: '1.0.0',
          },
        },
        skills: {
          'javascript': {
            name: 'JavaScript',
            description: 'Programming in JavaScript language',
            category: 'Programming',
            tags: ['programming', 'web'],
            level: 'intermediate',
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
      
      // Reset the mock to return our test ecosystem
      mockFs.readFile.mockReset();
      mockFs.readFile.mockResolvedValue(JSON.stringify(ecosystem));
      await manager.initialize();
    });

    it('should search across all types', async () => {
      const results = await manager.search('code');
      
      // Should find: developer-bot (coding in tags), code-reviewer (code in name), javascript (none - doesn't match)
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results.some(r => r.type === 'agent')).toBe(true);
      expect(results.some(r => r.type === 'role')).toBe(true);
      expect(results.some(r => r.type === 'skill')).toBe(false); // javascript doesn't match 'code'
    });

    it('should search specific type only', async () => {
      const results = await manager.search('analysis', 'agent');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe('Analyst AI');
      expect(results[0].type).toBe('agent');
    });

    it('should return empty results for no matches', async () => {
      const results = await manager.search('xyz-nonexistent-term-123');
      
      expect(results).toHaveLength(0);
    });

    it('should sort results by score', async () => {
      const results = await manager.search('developer');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe('Developer Bot');
      expect(results[0].score).toBe(1.0); // Exact match in name
    });
  });

  describe('list functionality', () => {
    beforeEach(async () => {
      const ecosystem = {
        agents: {
          'agent1': { 
            name: 'Agent 1', 
            description: 'First agent',
            roles: [],
            skills: [],
            tools: [],
            enabled: true,
            priority: 'medium',
            created: '2025-01-01T00:00:00.000Z',
            version: '1.0.0',
            tags: [],
            metadata: {},
          },
          'agent2': { 
            name: 'Agent 2', 
            description: 'Second agent',
            roles: [],
            skills: [],
            tools: [],
            enabled: true,
            priority: 'medium',
            created: '2025-01-01T00:00:00.000Z',
            version: '1.0.0',
            tags: [],
            metadata: {},
          },
        },
        roles: {
          'role1': { 
            name: 'Role 1', 
            description: 'First role',
            responsibilities: [],
            requiredSkills: [],
            optionalSkills: [],
            permissions: [],
            restrictions: [],
            priority: 'medium',
            created: '2025-01-01T00:00:00.000Z',
            version: '1.0.0',
            tags: [],
          },
        },
        skills: {
          'skill1': { 
            name: 'Skill 1', 
            description: 'First skill',
            level: 'beginner',
            prerequisites: [],
            tools: [],
            examples: [],
            restrictions: [],
            created: '2025-01-01T00:00:00.000Z',
            version: '1.0.0',
            tags: [],
          },
          'skill2': { 
            name: 'Skill 2', 
            description: 'Second skill',
            level: 'beginner',
            prerequisites: [],
            tools: [],
            examples: [],
            restrictions: [],
            created: '2025-01-01T00:00:00.000Z',
            version: '1.0.0',
            tags: [],
          },
        },
        version: '1.0.0',
        lastUpdated: '2025-01-01T00:00:00.000Z',
      };
      
      mockFs.readFile.mockReset();
      mockFs.readFile.mockResolvedValue(JSON.stringify(ecosystem));
      await manager.initialize();
    });

    it('should list all items when no type specified', async () => {
      const results = await manager.list();
      
      expect(results).toHaveLength(5); // 2 agents + 1 role + 2 skills
      expect(results.some(r => r.type === 'agent')).toBe(true);
      expect(results.some(r => r.type === 'role')).toBe(true);
      expect(results.some(r => r.type === 'skill')).toBe(true);
    });

    it('should list specific type only', async () => {
      const results = await manager.list('agent');
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.type === 'agent')).toBe(true);
    });

    it('should sort results alphabetically', async () => {
      const results = await manager.list('agent');
      
      expect(results[0].name).toBe('Agent 1');
      expect(results[1].name).toBe('Agent 2');
    });
  });

  describe('validation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should validate agent with warnings and suggestions', async () => {
      const agent = {
        name: 'Test Agent',
        description: 'Short', // Will trigger warning
        personality: undefined,
        instructions: undefined,
        roles: [], // Will trigger warning
        skills: [],
        tools: [],
        model: undefined,
        temperature: undefined,
        maxTokens: undefined,
        systemPrompt: undefined,
        enabled: true,
        priority: Priority.MEDIUM,
        created: new Date().toISOString(),
        version: '1.0.0',
        tags: [],
        metadata: {},
      };

      const result = manager.validateAgent(agent);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Agent description is quite short. Consider adding more detail.');
      expect(result.warnings).toContain('Agent has no roles or skills assigned. Consider adding some.');
    });

    it('should validate role with suggestions', async () => {
      const role = {
        name: 'Test Role',
        description: 'A test role',
        responsibilities: [], // Will trigger warning
        requiredSkills: [],
        optionalSkills: [],
        permissions: [],
        restrictions: [],
        priority: Priority.MEDIUM,
        created: new Date().toISOString(),
        version: '1.0.0',
        tags: [],
      };

      const result = manager.validateRole(role);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Role has no responsibilities defined. Consider adding some.');
    });

    it('should validate skill with suggestions', async () => {
      const skill = {
        name: 'Test Skill',
        description: 'A test skill',
        level: SkillLevel.BEGINNER,
        category: 'Testing',
        prerequisites: [],
        tools: [],
        examples: [], // Will trigger suggestion
        restrictions: [],
        created: new Date().toISOString(),
        version: '1.0.0',
        tags: [],
      };

      const result = manager.validateSkill(skill);
      
      expect(result.valid).toBe(true);
      expect(result.suggestions).toContain('Consider adding usage examples to help others understand the skill.');
    });
  });

  describe('markdown generation', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should generate properly formatted agent markdown', async () => {
      const template: GenerationTemplate = {
        type: 'agent',
        name: 'Markdown Agent',
        description: 'Test markdown generation',
        tags: ['test', 'markdown'],
        additionalFields: {
          personality: 'Friendly and helpful',
          roles: ['assistant'],
          skills: ['communication'],
        },
      };

      await manager.createAgent(template, { interactive: false });
      
      // Find the markdown file write call (not the ecosystem.json file)
      const markdownCall = mockFs.writeFile.mock.calls.find((call: any) => 
        call[0].includes('.md')
      );
      
      expect(markdownCall).toBeTruthy();
      const writtenContent = markdownCall[1];
      
      expect(writtenContent).toContain('---'); // YAML frontmatter
      expect(writtenContent).toContain('name: "Markdown Agent"');
      expect(writtenContent).toContain('# Markdown Agent');
      expect(writtenContent).toContain('## Personality');
      expect(writtenContent).toContain('Friendly and helpful');
      expect(writtenContent).toContain('## Roles');
      expect(writtenContent).toContain('- assistant');
      expect(writtenContent).toContain('## Skills');
      expect(writtenContent).toContain('- communication');
    });
  });
});
