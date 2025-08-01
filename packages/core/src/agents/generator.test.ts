/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/agents/generator.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractiveGenerator, PromptInterface } from './generator.js';
import { AgentManager } from './manager.js';
import { SkillLevel, Priority } from './types.js';

// Mock the AgentManager
const mockAgentManager = {
  createAgent: vi.fn(),
  createRole: vi.fn(),
  createSkill: vi.fn(),
  list: vi.fn(),
};

// Mock prompt interface
class MockPromptInterface implements PromptInterface {
  private responses: unknown[] = [];
  private currentIndex = 0;

  setResponses(responses: unknown[]) {
    this.responses = responses;
    this.currentIndex = 0;
  }

  async text(_message: string, initial?: string): Promise<string> {
    if (this.currentIndex < this.responses.length) {
      return (this.responses[this.currentIndex++] as string) || initial || '';
    }
    return initial || '';
  }

  async confirm(_message: string, initial?: boolean): Promise<boolean> {
    if (this.currentIndex < this.responses.length) {
      return (
        (this.responses[this.currentIndex++] as boolean) ?? initial ?? false
      );
    }
    return initial ?? false;
  }

  async select(
    _message: string,
    choices: Array<{ title: string; value: unknown }>,
  ): Promise<unknown> {
    if (this.currentIndex < this.responses.length) {
      const response = this.responses[this.currentIndex++];
      return response !== undefined ? response : choices[0].value;
    }
    return choices[0].value;
  }

  async multiselect(
    _message: string,
    _choices: Array<{ title: string; value: unknown; selected?: boolean }>,
  ): Promise<unknown[]> {
    if (this.currentIndex < this.responses.length) {
      return (this.responses[this.currentIndex++] as unknown[]) || [];
    }
    return [];
  }

  async number(
    _message: string,
    initial?: number,
    _min?: number,
    _max?: number,
  ): Promise<number> {
    if (this.currentIndex < this.responses.length) {
      return (this.responses[this.currentIndex++] as number) ?? initial ?? 0;
    }
    return initial ?? 0;
  }
}

describe('InteractiveGenerator', () => {
  let generator: InteractiveGenerator;
  let promptInterface: MockPromptInterface;

  beforeEach(() => {
    vi.clearAllMocks();
    promptInterface = new MockPromptInterface();
    generator = new InteractiveGenerator(
      promptInterface,
      mockAgentManager as unknown as AgentManager,
    );
  });

  describe('agent generation', () => {
    it('should generate agent with basic information', async () => {
      promptInterface.setResponses([
        'Test Agent', // name
        'A test agent for unit testing', // description
        '', // personality (empty)
        '', // instructions (empty)
        '', // system prompt (empty)
        false, // configure model
        Priority.MEDIUM, // priority
        [], // roles
        [], // skills
        [], // tools
        '', // tags
      ]);

      mockAgentManager.list.mockResolvedValue([]);
      mockAgentManager.createAgent.mockResolvedValue('/path/to/test-agent.md');

      const filePath = await generator.generateAgent({ interactive: true });

      expect(mockAgentManager.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent',
          name: 'Test Agent',
          description: 'A test agent for unit testing',
        }),
        expect.objectContaining({
          interactive: true,
        }),
      );

      expect(filePath).toBe('/path/to/test-agent.md');
    });

    it('should handle model configuration', async () => {
      promptInterface.setResponses([
        'Advanced Agent', // name
        'An advanced test agent', // description
        'Professional and efficient', // personality
        'Follow best practices', // instructions
        'You are a helpful assistant', // system prompt
        true, // configure model
        'gpt-4', // model
        '0.7', // temperature
        '2000', // max tokens
        Priority.HIGH, // priority
        [], // roles
        [], // skills
        [], // tools
        'advanced,ai', // tags (string)
      ]);

      mockAgentManager.list.mockResolvedValue([]);
      mockAgentManager.createAgent.mockResolvedValue(
        '/path/to/advanced-agent.md',
      );

      await generator.generateAgent({ interactive: true });

      expect(mockAgentManager.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          additionalFields: expect.objectContaining({
            model: 'gpt-4',
            temperature: 0.7,
            maxTokens: 2000,
            personality: 'Professional and efficient',
            instructions: 'Follow best practices',
            systemPrompt: 'You are a helpful assistant',
          }),
        }),
        expect.any(Object),
      );
    });

    it('should handle invalid temperature input', async () => {
      promptInterface.setResponses([
        'Test Agent',
        'Test description',
        '',
        '',
        '',
        true, // configure model
        '',
        'invalid', // invalid temperature
        '',
        Priority.MEDIUM,
        [],
        [],
        [],
        'test', // tags (string)
      ]);

      mockAgentManager.list.mockResolvedValue([]);
      mockAgentManager.createAgent.mockResolvedValue('/path/to/test-agent.md');

      await generator.generateAgent({ interactive: true });

      expect(mockAgentManager.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          additionalFields: expect.objectContaining({
            temperature: undefined, // Should be undefined due to invalid input
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('role generation', () => {
    it('should generate role with responsibilities', async () => {
      promptInterface.setResponses([
        'Test Role', // name
        'A test role for unit testing', // description
        true, // add responsibilities
        'Perform testing tasks', // responsibility 1
        'Write test reports', // responsibility 2
        '', // end responsibilities
        [], // required skills
        [], // optional skills
        false, // add permissions
        false, // add restrictions
        Priority.MEDIUM, // priority
        'testing,qa', // tags
      ]);

      mockAgentManager.list.mockResolvedValue([]);
      mockAgentManager.createRole.mockResolvedValue('/path/to/test-role.md');

      const filePath = await generator.generateRole({ interactive: true });

      expect(mockAgentManager.createRole).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'role',
          name: 'Test Role',
          description: 'A test role for unit testing',
          additionalFields: expect.objectContaining({
            responsibilities: ['Perform testing tasks', 'Write test reports'],
            priority: Priority.MEDIUM,
          }),
        }),
        expect.objectContaining({
          interactive: true,
        }),
      );

      expect(filePath).toBe('/path/to/test-role.md');
    });
  });

  describe('skill generation', () => {
    it('should generate skill with examples and prerequisites', async () => {
      promptInterface.setResponses([
        'Test Skill', // name
        'A test skill for unit testing', // description
        SkillLevel.INTERMEDIATE, // level
        'Testing', // category
        true, // add prerequisites
        'Basic programming knowledge', // prerequisite 1
        '', // end prerequisites
        [], // tools
        true, // add examples
        'Write unit tests for functions', // example 1
        'Create integration test suites', // example 2
        '', // end examples
        false, // add restrictions
        'testing,programming', // tags
      ]);

      mockAgentManager.list.mockResolvedValue([]);
      mockAgentManager.createSkill.mockResolvedValue('/path/to/test-skill.md');

      const filePath = await generator.generateSkill({ interactive: true });

      expect(mockAgentManager.createSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'skill',
          name: 'Test Skill',
          description: 'A test skill for unit testing',
          category: 'Testing',
          additionalFields: expect.objectContaining({
            level: SkillLevel.INTERMEDIATE,
            prerequisites: ['Basic programming knowledge'],
            examples: [
              'Write unit tests for functions',
              'Create integration test suites',
            ],
          }),
        }),
        expect.objectContaining({
          interactive: true,
        }),
      );

      expect(filePath).toBe('/path/to/test-skill.md');
    });

    it('should handle empty category', async () => {
      promptInterface.setResponses([
        'Simple Skill',
        'A simple skill',
        SkillLevel.BEGINNER,
        '', // empty category
        false, // no prerequisites
        [], // tools
        false, // no examples
        false, // no restrictions
        '',
      ]);

      mockAgentManager.list.mockResolvedValue([]);
      mockAgentManager.createSkill.mockResolvedValue(
        '/path/to/simple-skill.md',
      );

      await generator.generateSkill({ interactive: true });

      expect(mockAgentManager.createSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          category: undefined,
        }),
        expect.any(Object),
      );
    });
  });

  describe('error handling', () => {
    it('should throw error for missing agent name', async () => {
      promptInterface.setResponses([
        '', // empty name
      ]);

      await expect(
        generator.generateAgent({ interactive: true }),
      ).rejects.toThrow('Agent name is required');
    });

    it('should throw error for missing role description', async () => {
      promptInterface.setResponses([
        'Test Role', // name
        '', // empty description
      ]);

      await expect(
        generator.generateRole({ interactive: true }),
      ).rejects.toThrow('Role description is required');
    });

    it('should throw error for missing skill name', async () => {
      promptInterface.setResponses([
        '', // empty name
      ]);

      await expect(
        generator.generateSkill({ interactive: true }),
      ).rejects.toThrow('Skill name is required');
    });
  });

  describe('template integration', () => {
    it('should work with existing roles and skills', async () => {
      const existingRoles = [
        {
          name: 'Developer',
          description: 'Software developer role',
          type: 'role',
        },
        { name: 'Tester', description: 'Quality assurance role', type: 'role' },
      ];

      const existingSkills = [
        { name: 'JavaScript', description: 'Programming in JS', type: 'skill' },
        { name: 'Testing', description: 'Software testing', type: 'skill' },
      ];

      promptInterface.setResponses([
        'Full Stack Agent',
        'An agent for full stack development',
        '',
        '',
        '',
        false, // no model config
        Priority.HIGH,
        ['Developer'], // selected role
        ['JavaScript', 'Testing'], // selected skills
        ['read-file', 'write-file'], // selected tools
        'development,fullstack',
      ]);

      mockAgentManager.list
        .mockResolvedValueOnce(existingRoles) // for roles
        .mockResolvedValueOnce(existingSkills); // for skills

      mockAgentManager.createAgent.mockResolvedValue(
        '/path/to/full-stack-agent.md',
      );

      await generator.generateAgent({ interactive: true });

      expect(mockAgentManager.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          additionalFields: expect.objectContaining({
            roles: ['Developer'],
            skills: ['JavaScript', 'Testing'],
            tools: ['read-file', 'write-file'],
          }),
        }),
        expect.any(Object),
      );
    });
  });
});
