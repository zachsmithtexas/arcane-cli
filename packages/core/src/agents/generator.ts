/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/agents/generator.ts

/**
 * @fileoverview Interactive agent, role, and skill generation with guided prompts.
 *
 * This module provides interactive CLI prompts for creating agents, roles, and skills
 * with validation, templates, and user-friendly guidance.
 */

import {
  GenerationTemplate,
  GenerationOptions,
  SkillLevel,
  Priority,
} from './types.js';
import { AgentManager } from './manager.js';

/**
 * Prompt interface for getting user input.
 */
export interface PromptInterface {
  text(message: string, initial?: string): Promise<string>;
  confirm(message: string, initial?: boolean): Promise<boolean>;
  select(
    message: string,
    choices: Array<{ title: string; value: unknown }>,
  ): Promise<unknown>;
  multiselect(
    message: string,
    choices: Array<{ title: string; value: unknown; selected?: boolean }>,
  ): Promise<unknown[]>;
  number(
    message: string,
    initial?: number,
    min?: number,
    max?: number,
  ): Promise<number>;
}

/**
 * Interactive generator for agents, roles, and skills.
 */
export class InteractiveGenerator {
  constructor(
    private prompter: PromptInterface,
    private agentManager: AgentManager,
  ) {}

  /**
   * Interactively creates a new agent.
   */
  async generateAgent(
    options: GenerationOptions = { interactive: true },
  ): Promise<string> {
    console.log('🤖 Creating a new agent...\n');

    // Basic information
    const name = await this.prompter.text('Agent name:', '');
    if (!name) {
      throw new Error('Agent name is required');
    }

    const description = await this.prompter.text('Description:', '');
    if (!description) {
      throw new Error('Agent description is required');
    }

    // Personality and instructions
    const personality = await this.prompter.text('Personality (optional):', '');
    const instructions = await this.prompter.text(
      'Special instructions (optional):',
      '',
    );
    const systemPrompt = await this.prompter.text(
      'System prompt (optional):',
      '',
    );

    // Model configuration
    const configureModel = await this.prompter.confirm(
      'Configure model settings?',
      false,
    );
    let model: string | undefined;
    let temperature: number | undefined;
    let maxTokens: number | undefined;

    if (configureModel) {
      model = await this.prompter.text('Model name (optional):', '');
      const tempInput = await this.prompter.text(
        'Temperature (0-2, optional):',
        '',
      );
      const tokensInput = await this.prompter.text(
        'Max tokens (optional):',
        '',
      );

      if (tempInput) {
        temperature = parseFloat(tempInput);
        if (isNaN(temperature) || temperature < 0 || temperature > 2) {
          console.warn('Invalid temperature, using default');
          temperature = undefined;
        }
      }

      if (tokensInput) {
        maxTokens = parseInt(tokensInput, 10);
        if (isNaN(maxTokens) || maxTokens <= 0) {
          console.warn('Invalid max tokens, using default');
          maxTokens = undefined;
        }
      }
    }

    // Priority
    const priority = (await this.prompter.select('Priority level:', [
      { title: 'Low', value: Priority.LOW },
      { title: 'Medium', value: Priority.MEDIUM },
      { title: 'High', value: Priority.HIGH },
      { title: 'Critical', value: Priority.CRITICAL },
    ])) as Priority;

    // Roles and skills
    const roles = await this.selectRoles();
    const skills = await this.selectSkills();
    const tools = await this.selectTools();

    // Tags
    const tagsInput = await this.prompter.text(
      'Tags (comma-separated, optional):',
      '',
    );
    const tags =
      tagsInput && typeof tagsInput === 'string'
        ? tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
        : [];

    // Create template
    const template: GenerationTemplate = {
      type: 'agent',
      name,
      description,
      tags,
      additionalFields: {
        personality: personality || undefined,
        instructions: instructions || undefined,
        systemPrompt: systemPrompt || undefined,
        roles,
        skills,
        tools,
        model: model || undefined,
        temperature,
        maxTokens,
        priority,
        enabled: true,
      },
    };

    return await this.agentManager.createAgent(template, options);
  }

  /**
   * Interactively creates a new role.
   */
  async generateRole(
    options: GenerationOptions = { interactive: true },
  ): Promise<string> {
    console.log('👔 Creating a new role...\n');

    // Basic information
    const name = await this.prompter.text('Role name:', '');
    if (!name) {
      throw new Error('Role name is required');
    }

    const description = await this.prompter.text('Description:', '');
    if (!description) {
      throw new Error('Role description is required');
    }

    // Responsibilities
    const responsibilities: string[] = [];
    const addResponsibilities = await this.prompter.confirm(
      'Add responsibilities?',
      true,
    );

    if (addResponsibilities) {
      console.log(
        '\nEnter responsibilities (press Enter with empty input to finish):',
      );
      while (true) {
        const responsibility = await this.prompter.text(
          `Responsibility ${responsibilities.length + 1}:`,
          '',
        );
        if (!responsibility) break;
        responsibilities.push(responsibility);
      }
    }

    // Skills
    const requiredSkills = await this.selectSkills('Select required skills:');
    const optionalSkills = await this.selectSkills('Select optional skills:');

    // Permissions
    const permissions: string[] = [];
    const addPermissions = await this.prompter.confirm(
      'Add permissions?',
      false,
    );

    if (addPermissions) {
      console.log(
        '\nEnter permissions (press Enter with empty input to finish):',
      );
      while (true) {
        const permission = await this.prompter.text(
          `Permission ${permissions.length + 1}:`,
          '',
        );
        if (!permission) break;
        permissions.push(permission);
      }
    }

    // Restrictions
    const restrictions: string[] = [];
    const addRestrictions = await this.prompter.confirm(
      'Add restrictions?',
      false,
    );

    if (addRestrictions) {
      console.log(
        '\nEnter restrictions (press Enter with empty input to finish):',
      );
      while (true) {
        const restriction = await this.prompter.text(
          `Restriction ${restrictions.length + 1}:`,
          '',
        );
        if (!restriction) break;
        restrictions.push(restriction);
      }
    }

    // Priority
    const priority = (await this.prompter.select('Priority level:', [
      { title: 'Low', value: Priority.LOW },
      { title: 'Medium', value: Priority.MEDIUM },
      { title: 'High', value: Priority.HIGH },
      { title: 'Critical', value: Priority.CRITICAL },
    ])) as Priority;

    // Tags
    const tagsInput = await this.prompter.text(
      'Tags (comma-separated, optional):',
      '',
    );
    const tags =
      tagsInput && typeof tagsInput === 'string'
        ? tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
        : [];

    // Create template
    const template: GenerationTemplate = {
      type: 'role',
      name,
      description,
      tags,
      additionalFields: {
        responsibilities,
        requiredSkills,
        optionalSkills,
        permissions,
        restrictions,
        priority,
      },
    };

    return await this.agentManager.createRole(template, options);
  }

  /**
   * Interactively creates a new skill.
   */
  async generateSkill(
    options: GenerationOptions = { interactive: true },
  ): Promise<string> {
    console.log('🎯 Creating a new skill...\n');

    // Basic information
    const name = await this.prompter.text('Skill name:', '');
    if (!name) {
      throw new Error('Skill name is required');
    }

    const description = await this.prompter.text('Description:', '');
    if (!description) {
      throw new Error('Skill description is required');
    }

    // Level
    const level = (await this.prompter.select('Skill level:', [
      { title: 'Beginner', value: SkillLevel.BEGINNER },
      { title: 'Intermediate', value: SkillLevel.INTERMEDIATE },
      { title: 'Advanced', value: SkillLevel.ADVANCED },
      { title: 'Expert', value: SkillLevel.EXPERT },
    ])) as SkillLevel;

    // Category
    const category = await this.prompter.text('Category (optional):', '');

    // Prerequisites
    const prerequisites: string[] = [];
    const addPrerequisites = await this.prompter.confirm(
      'Add prerequisites?',
      false,
    );

    if (addPrerequisites) {
      console.log(
        '\nEnter prerequisites (press Enter with empty input to finish):',
      );
      while (true) {
        const prerequisite = await this.prompter.text(
          `Prerequisite ${prerequisites.length + 1}:`,
          '',
        );
        if (!prerequisite) break;
        prerequisites.push(prerequisite);
      }
    }

    // Tools
    const tools = await this.selectTools();

    // Examples
    const examples: string[] = [];
    const addExamples = await this.prompter.confirm(
      'Add usage examples?',
      true,
    );

    if (addExamples) {
      console.log('\nEnter examples (press Enter with empty input to finish):');
      while (true) {
        const example = await this.prompter.text(
          `Example ${examples.length + 1}:`,
          '',
        );
        if (!example) break;
        examples.push(example);
      }
    }

    // Restrictions
    const restrictions: string[] = [];
    const addRestrictions = await this.prompter.confirm(
      'Add restrictions?',
      false,
    );

    if (addRestrictions) {
      console.log(
        '\nEnter restrictions (press Enter with empty input to finish):',
      );
      while (true) {
        const restriction = await this.prompter.text(
          `Restriction ${restrictions.length + 1}:`,
          '',
        );
        if (!restriction) break;
        restrictions.push(restriction);
      }
    }

    // Tags
    const tagsInput = await this.prompter.text(
      'Tags (comma-separated, optional):',
      '',
    );
    const tags =
      tagsInput && typeof tagsInput === 'string'
        ? tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t.length > 0)
        : [];

    // Create template
    const template: GenerationTemplate = {
      type: 'skill',
      name,
      description,
      category: category || undefined,
      tags,
      additionalFields: {
        level,
        prerequisites,
        tools,
        examples,
        restrictions,
      },
    };

    return await this.agentManager.createSkill(template, options);
  }

  /**
   * Searches and allows selection of existing roles.
   */
  private async selectRoles(
    message: string = 'Select roles:',
  ): Promise<string[]> {
    const existingRoles = await this.agentManager.list('role');

    if (existingRoles.length === 0) {
      console.log('No existing roles found. You can create roles separately.');
      return [];
    }

    const choices = existingRoles.map((role) => ({
      title: `${role.name} - ${role.description}`,
      value: role.name,
      selected: false,
    }));

    return (await this.prompter.multiselect(message, choices)) as string[];
  }

  /**
   * Searches and allows selection of existing skills.
   */
  private async selectSkills(
    message: string = 'Select skills:',
  ): Promise<string[]> {
    const existingSkills = await this.agentManager.list('skill');

    if (existingSkills.length === 0) {
      console.log(
        'No existing skills found. You can create skills separately.',
      );
      return [];
    }

    const choices = existingSkills.map((skill) => ({
      title: `${skill.name} - ${skill.description}`,
      value: skill.name,
      selected: false,
    }));

    return (await this.prompter.multiselect(message, choices)) as string[];
  }

  /**
   * Allows selection of tools from predefined list.
   */
  private async selectTools(): Promise<string[]> {
    const availableTools = [
      'read-file',
      'write-file',
      'edit-file',
      'list-files',
      'search-code',
      'shell',
      'web-search',
      'web-fetch',
      'memory',
      'mcp-client',
    ];

    const choices = availableTools.map((tool) => ({
      title: tool,
      value: tool,
      selected: false,
    }));

    return (await this.prompter.multiselect(
      'Select available tools:',
      choices,
    )) as string[];
  }
}

/**
 * Template definitions for common agent types.
 */
export const AGENT_TEMPLATES: Record<string, Partial<GenerationTemplate>> = {
  developer: {
    description:
      'A software developer agent capable of writing, reviewing, and debugging code',
    tags: ['coding', 'development', 'technical'],
    additionalFields: {
      skills: ['programming', 'debugging', 'code-review'],
      tools: ['read-file', 'write-file', 'edit-file', 'search-code', 'shell'],
      personality: 'Analytical, detail-oriented, and focused on best practices',
    },
  },
  analyst: {
    description:
      'A data analyst agent for processing and analyzing information',
    tags: ['analysis', 'data', 'research'],
    additionalFields: {
      skills: ['data-analysis', 'research', 'reporting'],
      tools: ['read-file', 'web-search', 'memory'],
      personality: 'Methodical, thorough, and objective in analysis',
    },
  },
  writer: {
    description:
      'A content writer agent for creating documentation and articles',
    tags: ['writing', 'content', 'documentation'],
    additionalFields: {
      skills: ['writing', 'editing', 'documentation'],
      tools: ['read-file', 'write-file', 'web-search'],
      personality: 'Creative, articulate, and focused on clarity',
    },
  },
  researcher: {
    description: 'A research agent for gathering and synthesizing information',
    tags: ['research', 'information', 'synthesis'],
    additionalFields: {
      skills: ['research', 'analysis', 'synthesis'],
      tools: ['web-search', 'web-fetch', 'memory', 'read-file'],
      personality: 'Curious, thorough, and evidence-based',
    },
  },
};

/**
 * Template definitions for common roles.
 */
export const ROLE_TEMPLATES: Record<string, Partial<GenerationTemplate>> = {
  'project-manager': {
    description:
      'Manages projects, coordinates tasks, and ensures deliverables',
    additionalFields: {
      responsibilities: [
        'Plan and coordinate project activities',
        'Monitor progress and deadlines',
        'Communicate with stakeholders',
        'Manage resources and dependencies',
      ],
      requiredSkills: ['project-management', 'communication', 'leadership'],
      priority: Priority.HIGH,
    },
  },
  'code-reviewer': {
    description: 'Reviews code for quality, security, and best practices',
    additionalFields: {
      responsibilities: [
        'Review pull requests and code changes',
        'Ensure code quality and standards',
        'Identify security vulnerabilities',
        'Provide constructive feedback',
      ],
      requiredSkills: ['code-review', 'security-analysis', 'programming'],
    },
  },
  'technical-writer': {
    description: 'Creates and maintains technical documentation',
    additionalFields: {
      responsibilities: [
        'Write clear and comprehensive documentation',
        'Maintain API documentation',
        'Create user guides and tutorials',
        'Ensure documentation accuracy',
      ],
      requiredSkills: ['technical-writing', 'documentation', 'communication'],
    },
  },
};

/**
 * Template definitions for common skills.
 */
export const SKILL_TEMPLATES: Record<string, Partial<GenerationTemplate>> = {
  programming: {
    description:
      'Ability to write, debug, and maintain code in various languages',
    additionalFields: {
      level: SkillLevel.INTERMEDIATE,
      category: 'Development',
      tools: ['read-file', 'write-file', 'edit-file', 'shell'],
      examples: [
        'Write a Python script to process CSV data',
        'Debug a JavaScript application',
        'Refactor legacy code for better maintainability',
      ],
    },
  },
  'data-analysis': {
    description:
      'Analyze data patterns, trends, and insights from various sources',
    additionalFields: {
      level: SkillLevel.INTERMEDIATE,
      category: 'Analytics',
      tools: ['read-file', 'web-search', 'memory'],
      examples: [
        'Analyze sales data to identify trends',
        'Create statistical reports from survey data',
        'Identify patterns in user behavior data',
      ],
    },
  },
  'technical-writing': {
    description: 'Create clear, comprehensive technical documentation',
    additionalFields: {
      level: SkillLevel.INTERMEDIATE,
      category: 'Communication',
      tools: ['write-file', 'read-file', 'web-search'],
      examples: [
        'Write API documentation with examples',
        'Create user guides for software applications',
        'Document system architecture and design decisions',
      ],
    },
  },
  'code-review': {
    description: 'Review code for quality, security, and maintainability',
    additionalFields: {
      level: SkillLevel.ADVANCED,
      category: 'Development',
      prerequisites: ['programming'],
      tools: ['read-file', 'search-code'],
      examples: [
        'Review pull requests for security vulnerabilities',
        'Ensure code follows established style guidelines',
        'Identify potential performance issues in code',
      ],
    },
  },
};
