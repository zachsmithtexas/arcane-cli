/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/agents/manager.ts

/**
 * @fileoverview Agent ecosystem management system.
 *
 * This module provides functionality for managing agents, roles, and skills
 * including creation, validation, search, and file system operations.
 */

import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';
import {
  Agent,
  Role,
  Skill,
  AgentEcosystem,
  AgentSchema,
  RoleSchema,
  SkillSchema,
  GenerationTemplate,
  GenerationOptions,
  SearchResult,
  ValidationResult,
  SkillLevel,
  Priority,
} from './types.js';
import { MetadataManager } from './metadata.js';

/**
 * Default directory structure for agents.
 */
export const DEFAULT_ARCANE_DIR = resolve(homedir(), '.arcane');
export const AGENTS_DIR = 'agents';
export const ROLES_DIR = 'roles';
export const SKILLS_DIR = 'skills';

/**
 * Manages the agent ecosystem including agents, roles, and skills.
 */
export class AgentManager {
  private arcaneDir: string;
  private ecosystem: AgentEcosystem | null = null;
  private metadataManager: MetadataManager;

  constructor(arcaneDir: string = DEFAULT_ARCANE_DIR) {
    this.arcaneDir = arcaneDir;
    this.metadataManager = new MetadataManager(arcaneDir);
  }

  /**
   * Initializes the agent manager and creates necessary directories.
   */
  async initialize(): Promise<void> {
    await this.ensureDirectories();
    await this.loadEcosystemFromFiles();
  }

  /**
   * Loads or refreshes the ecosystem from markdown files.
   */
  private async loadEcosystemFromFiles(): Promise<void> {
    this.ecosystem = await this.metadataManager.rebuildEcosystemFromMetadata();
  }

  /**
   * Creates a new agent with enhanced metadata support.
   */
  async createAgent(
    template: GenerationTemplate,
    options: GenerationOptions = { interactive: false },
  ): Promise<string> {
    if (template.type !== 'agent') {
      throw new Error('Template type must be "agent"');
    }

    const agent: Agent = {
      name: template.name,
      description: template.description,
      personality: template.additionalFields?.personality as string | undefined,
      instructions: template.additionalFields?.instructions as
        | string
        | undefined,
      roles: (template.additionalFields?.roles as string[]) || [],
      skills: (template.additionalFields?.skills as string[]) || [],
      tools: (template.additionalFields?.tools as string[]) || [],
      model: template.additionalFields?.model as string | undefined,
      temperature: template.additionalFields?.temperature as number | undefined,
      maxTokens: template.additionalFields?.maxTokens as number | undefined,
      systemPrompt: template.additionalFields?.systemPrompt as
        | string
        | undefined,
      enabled: (template.additionalFields?.enabled as boolean) ?? true,
      priority:
        (template.additionalFields?.priority as Priority) || Priority.MEDIUM,
      created: new Date().toISOString(),
      version: '1.0.0',
      tags: template.tags || [],
      metadata:
        (template.additionalFields?.metadata as Record<string, unknown>) || {},
    };

    const validation = this.validateAgent(agent);
    if (!validation.valid) {
      throw new Error(
        `Agent validation failed: ${validation.errors.join(', ')}`,
      );
    }

    let agentPath: string;

    if (options.dryRun) {
      const agentSlug = agent.name.toLowerCase().replace(/\s+/g, '-');
      agentPath = join(this.arcaneDir, AGENTS_DIR, agentSlug);
      console.log(`[DRY RUN] Would create agent directory at: ${agentPath}`);
    } else {
      agentPath = await this.metadataManager.createAgentDirectory(agent);
      await this.loadEcosystemFromFiles(); // Refresh ecosystem
    }

    return agentPath;
  }

  /**
   * Creates a new role with enhanced metadata support.
   */
  async createRole(
    template: GenerationTemplate,
    options: GenerationOptions = { interactive: false },
  ): Promise<string> {
    if (template.type !== 'role') {
      throw new Error('Template type must be "role"');
    }

    const role: Role = {
      name: template.name,
      description: template.description,
      responsibilities:
        (template.additionalFields?.responsibilities as string[]) || [],
      requiredSkills:
        (template.additionalFields?.requiredSkills as string[]) || [],
      optionalSkills:
        (template.additionalFields?.optionalSkills as string[]) || [],
      permissions: (template.additionalFields?.permissions as string[]) || [],
      restrictions: (template.additionalFields?.restrictions as string[]) || [],
      priority:
        (template.additionalFields?.priority as Priority) || Priority.MEDIUM,
      created: new Date().toISOString(),
      version: '1.0.0',
      tags: template.tags || [],
    };

    const validation = this.validateRole(role);
    if (!validation.valid) {
      throw new Error(
        `Role validation failed: ${validation.errors.join(', ')}`,
      );
    }

    let rolePath: string;

    if (options.dryRun) {
      const roleSlug = role.name.toLowerCase().replace(/\s+/g, '-');
      rolePath = join(this.arcaneDir, ROLES_DIR, roleSlug);
      console.log(`[DRY RUN] Would create role directory at: ${rolePath}`);
    } else {
      rolePath = await this.metadataManager.createRoleDirectory(role);
      await this.loadEcosystemFromFiles(); // Refresh ecosystem
    }

    return rolePath;
  }

  /**
   * Creates a new skill with enhanced metadata support.
   */
  async createSkill(
    template: GenerationTemplate,
    options: GenerationOptions = { interactive: false },
  ): Promise<string> {
    if (template.type !== 'skill') {
      throw new Error('Template type must be "skill"');
    }

    const skill: Skill = {
      name: template.name,
      description: template.description,
      level:
        (template.additionalFields?.level as SkillLevel) || SkillLevel.BEGINNER,
      category: (template.category ||
        template.additionalFields?.category) as string,
      prerequisites:
        (template.additionalFields?.prerequisites as string[]) || [],
      tools: (template.additionalFields?.tools as string[]) || [],
      examples: (template.additionalFields?.examples as string[]) || [],
      restrictions: (template.additionalFields?.restrictions as string[]) || [],
      created: new Date().toISOString(),
      version: '1.0.0',
      tags: template.tags || [],
    };

    const validation = this.validateSkill(skill);
    if (!validation.valid) {
      throw new Error(
        `Skill validation failed: ${validation.errors.join(', ')}`,
      );
    }

    let skillPath: string;

    if (options.dryRun) {
      const skillSlug = skill.name.toLowerCase().replace(/\s+/g, '-');
      skillPath = join(this.arcaneDir, SKILLS_DIR, skillSlug);
      console.log(`[DRY RUN] Would create skill directory at: ${skillPath}`);
    } else {
      skillPath = await this.metadataManager.createSkillDirectory(skill);
      await this.loadEcosystemFromFiles(); // Refresh ecosystem
    }

    return skillPath;
  }

  /**
   * Gets the metadata manager instance.
   */
  getMetadataManager(): MetadataManager {
    return this.metadataManager;
  }

  /**
   * Rebuilds ecosystem from metadata files.
   */
  async rebuildFromMetadata(): Promise<void> {
    await this.loadEcosystemFromFiles();
  }

  /**
   * Searches for agents, roles, or skills using fuzzy matching.
   */
  async search(
    query: string,
    type?: 'agent' | 'role' | 'skill',
  ): Promise<SearchResult[]> {
    if (!this.ecosystem) await this.loadEcosystemFromFiles();
    if (!this.ecosystem) return [];

    const results: SearchResult[] = [];
    const agentFiles = await this.metadataManager.listMetadataFiles('agents');
    const roleFiles = await this.metadataManager.listMetadataFiles('roles');
    const skillFiles = await this.metadataManager.listMetadataFiles('skills');

    // Search agents
    if (!type || type === 'agent') {
      for (const agent of Object.values(this.ecosystem.agents)) {
        const score = this.fuzzyMatch(
          query,
          `${agent.name} ${agent.description} ${agent.tags.join(' ')}`,
        );
        if (score > 0) {
          const file = agentFiles.find(
            (f) => f.frontmatter.name === agent.name,
          );
          results.push({
            type: 'agent',
            name: agent.name,
            description: agent.description,
            score,
            path: file?.path || '',
          });
        }
      }
    }

    // Search roles
    if (!type || type === 'role') {
      for (const role of Object.values(this.ecosystem.roles)) {
        const score = this.fuzzyMatch(
          query,
          `${role.name} ${role.description} ${role.tags.join(' ')}`,
        );
        if (score > 0) {
          const file = roleFiles.find((f) => f.frontmatter.name === role.name);
          results.push({
            type: 'role',
            name: role.name,
            description: role.description,
            score,
            path: file?.path || '',
          });
        }
      }
    }

    // Search skills
    if (!type || type === 'skill') {
      for (const skill of Object.values(this.ecosystem.skills)) {
        const score = this.fuzzyMatch(
          query,
          `${skill.name} ${skill.description} ${skill.category || ''} ${skill.tags.join(' ')}`,
        );
        if (score > 0) {
          const file = skillFiles.find(
            (f) => f.frontmatter.name === skill.name,
          );
          results.push({
            type: 'skill',
            name: skill.name,
            description: skill.description,
            score,
            path: file?.path || '',
          });
        }
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Lists all agents, roles, or skills.
   */
  async list(type?: 'agent' | 'role' | 'skill'): Promise<SearchResult[]> {
    if (!this.ecosystem) await this.loadEcosystemFromFiles();
    if (!this.ecosystem) return [];

    const results: SearchResult[] = [];
    const agentFiles = await this.metadataManager.listMetadataFiles('agents');
    const roleFiles = await this.metadataManager.listMetadataFiles('roles');
    const skillFiles = await this.metadataManager.listMetadataFiles('skills');

    if (!type || type === 'agent') {
      for (const agent of Object.values(this.ecosystem.agents)) {
        const file = agentFiles.find((f) => f.frontmatter.name === agent.name);
        results.push({
          type: 'agent',
          name: agent.name,
          description: agent.description,
          score: 1,
          path: file?.path || '',
        });
      }
    }

    if (!type || type === 'role') {
      for (const role of Object.values(this.ecosystem.roles)) {
        const file = roleFiles.find((f) => f.frontmatter.name === role.name);
        results.push({
          type: 'role',
          name: role.name,
          description: role.description,
          score: 1,
          path: file?.path || '',
        });
      }
    }

    if (!type || type === 'skill') {
      for (const skill of Object.values(this.ecosystem.skills)) {
        const file = skillFiles.find((f) => f.frontmatter.name === skill.name);
        results.push({
          type: 'skill',
          name: skill.name,
          description: skill.description,
          score: 1,
          path: file?.path || '',
        });
      }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Gets a specific agent by name, loading from metadata if available.
   */
  async getAgent(name: string): Promise<Agent | null> {
    // Try loading from metadata first
    const agent = await this.metadataManager.loadAgentMetadata(name);
    if (agent) {
      return agent;
    }

    // Fall back to ecosystem
    if (!this.ecosystem) await this.loadEcosystemFromFiles();
    return this.ecosystem?.agents[name] || null;
  }

  /**
   * Gets a specific role by name, loading from metadata if available.
   */
  async getRole(name: string): Promise<Role | null> {
    // Try loading from metadata first
    const role = await this.metadataManager.loadRoleMetadata(name);
    if (role) {
      return role;
    }

    // Fall back to ecosystem
    if (!this.ecosystem) await this.loadEcosystemFromFiles();
    return this.ecosystem?.roles[name] || null;
  }

  /**
   * Gets a specific skill by name, loading from metadata if available.
   */
  async getSkill(name: string): Promise<Skill | null> {
    // Try loading from metadata first
    const skill = await this.metadataManager.loadSkillMetadata(name);
    if (skill) {
      return skill;
    }

    // Fall back to ecosystem
    if (!this.ecosystem) await this.loadEcosystemFromFiles();
    return this.ecosystem?.skills[name] || null;
  }

  /**
   * Validates an agent definition.
   */
  validateAgent(agent: Agent): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      AgentSchema.parse(agent);
    } catch (error) {
      result.valid = false;
      if (error instanceof Error) {
        result.errors.push(error.message);
      }
    }

    if (agent.name.length < 2) {
      result.errors.push('Agent name must be at least 2 characters long');
      result.valid = false;
    }

    if (agent.description.length < 10) {
      result.warnings.push(
        'Agent description is quite short. Consider adding more detail.',
      );
    }

    if (agent.roles.length === 0 && agent.skills.length === 0) {
      result.warnings.push(
        'Agent has no roles or skills assigned. Consider adding some.',
      );
    }

    return result;
  }

  /**
   * Validates a role definition.
   */
  validateRole(role: Role): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      RoleSchema.parse(role);
    } catch (error) {
      result.valid = false;
      if (error instanceof Error) {
        result.errors.push(error.message);
      }
    }

    if (role.name.length < 2) {
      result.errors.push('Role name must be at least 2 characters long');
      result.valid = false;
    }

    if (role.responsibilities.length === 0) {
      result.warnings.push(
        'Role has no responsibilities defined. Consider adding some.',
      );
    }

    return result;
  }

  /**
   * Validates a skill definition.
   */
  validateSkill(skill: Skill): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      SkillSchema.parse(skill);
    } catch (error) {
      result.valid = false;
      if (error instanceof Error) {
        result.errors.push(error.message);
      }
    }

    if (skill.examples.length === 0) {
      result.suggestions.push(
        'Consider adding usage examples to help others understand the skill.',
      );
    }

    return result;
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.arcaneDir,
      join(this.arcaneDir, AGENTS_DIR),
      join(this.arcaneDir, ROLES_DIR),
      join(this.arcaneDir, SKILLS_DIR),
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (_error) {
        // Directory might already exist
      }
    }
  }

  private fuzzyMatch(query: string, text: string): number {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    if (textLower.includes(queryLower)) {
      return 1.0;
    }

    const words = queryLower.split(' ').filter((w) => w.length > 0);
    let matchedWords = 0;

    for (const word of words) {
      if (textLower.includes(word)) {
        matchedWords++;
      }
    }

    if (matchedWords > 0) {
      return (matchedWords / words.length) * 0.8;
    }

    let score = 0;
    let lastIndex = -1;

    for (const char of queryLower) {
      const index = textLower.indexOf(char, lastIndex + 1);
      if (index > lastIndex) {
        score += 1;
        lastIndex = index;
      }
    }

    return score > 0 ? (score / queryLower.length) * 0.6 : 0;
  }
}

/**
 * Global agent manager instance.
 */
let globalAgentManager: AgentManager | null = null;

/**
 * Gets or creates the global agent manager.
 */
export function getAgentManager(arcaneDir?: string): AgentManager {
  if (!globalAgentManager) {
    globalAgentManager = new AgentManager(arcaneDir);
  }
  return globalAgentManager;
}

/**
 * Initializes the global agent manager.
 */
export async function initializeAgentManager(
  arcaneDir?: string,
): Promise<void> {
  const manager = getAgentManager(arcaneDir);
  await manager.initialize();
}
