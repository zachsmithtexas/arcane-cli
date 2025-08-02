/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/agents/capabilities.test.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AgentManager } from './manager.js';
import { Agent, Role, Skill } from './types.js';

describe('AgentManager - getAgentCapabilities', () => {
  let agentManager: AgentManager;

  const mockAgent: Agent = {
    name: 'Test Agent',
    description: 'An agent for testing',
    tools: ['baseTool'],
    roles: ['testRole'],
    skills: ['testSkill'],
    created: new Date().toISOString(),
    version: '1.0.0',
    tags: [],
    enabled: true,
    priority: 'medium',
  };

  const mockRole: Role = {
    name: 'testRole',
    description: 'A role for testing',
    allowedTools: ['roleTool', 'sharedTool'],
    restrictedTools: ['baseTool', 'restrictedByRole'],
    responsibilities: [],
    requiredSkills: [],
    optionalSkills: [],
    created: new Date().toISOString(),
    version: '1.0.0',
    tags: [],
    priority: 'medium',
  };

  const mockSkill: Skill = {
    name: 'testSkill',
    description: 'A skill for testing',
    allowedTools: ['skillTool', 'sharedTool'],
    restrictedTools: ['restrictedBySkill'],
    level: 'beginner',
    examples: [],
    created: new Date().toISOString(),
    version: '1.0.0',
    tags: [],
  };

  beforeEach(() => {
    agentManager = new AgentManager();
    vi.spyOn(agentManager, 'getAgent').mockImplementation(async (name) => {
      if (name === 'Test Agent') {
        return mockAgent;
      }
      if (name === 'Empty Agent') {
        return {
          ...mockAgent,
          name: 'Empty Agent',
          tools: [],
          roles: [],
          skills: [],
        };
      }
      return null;
    });

    vi.spyOn(agentManager, 'getRole').mockImplementation(async (name) => {
      if (name === 'testRole') {
        return mockRole;
      }
      return null;
    });

    vi.spyOn(agentManager, 'getSkill').mockImplementation(async (name) => {
      if (name === 'testSkill') {
        return mockSkill;
      }
      return null;
    });
  });

  it('should return the agent base tools if no roles or skills are assigned', async () => {
    const capabilities = await agentManager.getAgentCapabilities('Empty Agent');
    expect(capabilities).toEqual([]);
  });

  it('should combine tools from agent, roles, and skills', async () => {
    const capabilities = await agentManager.getAgentCapabilities('Test Agent');
    const expected = ['roleTool', 'sharedTool', 'skillTool'];
    expect(capabilities).toHaveLength(expected.length);
    expect(capabilities.sort()).toEqual(expected.sort());
  });

  it('should restrict tools defined in roles', async () => {
    const capabilities = await agentManager.getAgentCapabilities('Test Agent');
    expect(capabilities).not.toContain('baseTool');
    expect(capabilities).not.toContain('restrictedByRole');
  });

  it('should restrict tools defined in skills', async () => {
    const capabilities = await agentManager.getAgentCapabilities('Test Agent');
    expect(capabilities).not.toContain('restrictedBySkill');
  });

  it('should handle a tool being allowed by one and restricted by another', async () => {
    vi.spyOn(agentManager, 'getRole').mockResolvedValue({
      ...mockRole,
      restrictedTools: ['skillTool'],
    });
    const capabilities = await agentManager.getAgentCapabilities('Test Agent');
    expect(capabilities).not.toContain('skillTool');
  });

  it('should return an empty array for a non-existent agent', async () => {
    const capabilities =
      await agentManager.getAgentCapabilities('NonExistentAgent');
    expect(capabilities).toEqual([]);
  });

  it('should handle roles or skills not being found', async () => {
    vi.spyOn(agentManager, 'getRole').mockResolvedValue(null);
    vi.spyOn(agentManager, 'getSkill').mockResolvedValue(null);
    const capabilities = await agentManager.getAgentCapabilities('Test Agent');
    expect(capabilities).toEqual(['baseTool']);
  });
});
