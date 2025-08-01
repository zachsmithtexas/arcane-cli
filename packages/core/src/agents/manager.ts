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
  AgentEcosystemSchema,
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

  constructor(arcaneDir: string = DEFAULT_ARCANE_DIR) {
    this.arcaneDir = arcaneDir;
  }

  /**
   * Initializes the agent manager and creates necessary directories.
   */
  async initialize(): Promise<void> {
    await this.ensureDirectories();
    await this.loadEcosystem();
  }

  /**
   * Creates a new agent with the given template.
   */
  async createAgent(template: GenerationTemplate, options: GenerationOptions = { interactive: false }): Promise<string> {
    if (template.type !== 'agent') {
      throw new Error('Template type must be "agent"');
    }

    const agent: Agent = {
      name: template.name,
      description: template.description,
      personality: template.additionalFields?.personality || undefined,
      instructions: template.additionalFields?.instructions || undefined,
      roles: template.additionalFields?.roles || [],
      skills: template.additionalFields?.skills || [],
      tools: template.additionalFields?.tools || [],
      model: template.additionalFields?.model || undefined,
      temperature: template.additionalFields?.temperature || undefined,
      maxTokens: template.additionalFields?.maxTokens || undefined,
      systemPrompt: template.additionalFields?.systemPrompt || undefined,
      enabled: template.additionalFields?.enabled ?? true,
      priority: template.additionalFields?.priority || Priority.MEDIUM,
      created: new Date().toISOString(),
      version: '1.0.0',
      tags: template.tags || [],
      metadata: template.additionalFields?.metadata || {},
    };

    // Validate the agent
    const validation = this.validateAgent(agent);
    if (!validation.valid) {
      throw new Error(`Agent validation failed: ${validation.errors.join(', ')}`);
    }

    const agentPath = await this.writeAgentFile(agent, options);
    
    // Update ecosystem
    await this.loadEcosystem();
    if (this.ecosystem) {
      this.ecosystem.agents[agent.name] = agent;
      this.ecosystem.lastUpdated = new Date().toISOString();
      await this.saveEcosystem();
    }

    return agentPath;
  }

  /**
   * Creates a new role with the given template.
   */
  async createRole(template: GenerationTemplate, options: GenerationOptions = { interactive: false }): Promise<string> {
    if (template.type !== 'role') {
      throw new Error('Template type must be "role"');
    }

    const role: Role = {
      name: template.name,
      description: template.description,
      responsibilities: template.additionalFields?.responsibilities || [],
      requiredSkills: template.additionalFields?.requiredSkills || [],
      optionalSkills: template.additionalFields?.optionalSkills || [],
      permissions: template.additionalFields?.permissions || [],
      restrictions: template.additionalFields?.restrictions || [],
      priority: template.additionalFields?.priority || Priority.MEDIUM,
      created: new Date().toISOString(),
      version: '1.0.0',
      tags: template.tags || [],
    };

    // Validate the role
    const validation = this.validateRole(role);
    if (!validation.valid) {
      throw new Error(`Role validation failed: ${validation.errors.join(', ')}`);
    }

    const rolePath = await this.writeRoleFile(role, options);
    
    // Update ecosystem
    await this.loadEcosystem();
    if (this.ecosystem) {
      this.ecosystem.roles[role.name] = role;
      this.ecosystem.lastUpdated = new Date().toISOString();
      await this.saveEcosystem();
    }

    return rolePath;
  }

  /**
   * Creates a new skill with the given template.
   */
  async createSkill(template: GenerationTemplate, options: GenerationOptions = { interactive: false }): Promise<string> {
    if (template.type !== 'skill') {
      throw new Error('Template type must be "skill"');
    }

    const skill: Skill = {
      name: template.name,
      description: template.description,
      level: template.additionalFields?.level || SkillLevel.BEGINNER,
      category: template.category || template.additionalFields?.category,
      prerequisites: template.additionalFields?.prerequisites || [],
      tools: template.additionalFields?.tools || [],
      examples: template.additionalFields?.examples || [],
      restrictions: template.additionalFields?.restrictions || [],
      created: new Date().toISOString(),
      version: '1.0.0',
      tags: template.tags || [],
    };

    // Validate the skill
    const validation = this.validateSkill(skill);
    if (!validation.valid) {
      throw new Error(`Skill validation failed: ${validation.errors.join(', ')}`);
    }

    const skillPath = await this.writeSkillFile(skill, options);
    
    // Update ecosystem
    await this.loadEcosystem();
    if (this.ecosystem) {
      this.ecosystem.skills[skill.name] = skill;
      this.ecosystem.lastUpdated = new Date().toISOString();
      await this.saveEcosystem();
    }

    return skillPath;
  }

  /**
   * Searches for agents, roles, or skills using fuzzy matching.
   */
  async search(query: string, type?: 'agent' | 'role' | 'skill'): Promise<SearchResult[]> {
    await this.loadEcosystem();
    if (!this.ecosystem) {
      return [];
    }

    const results: SearchResult[] = [];

    // Search agents
    if (!type || type === 'agent') {
      for (const [key, agent] of Object.entries(this.ecosystem.agents)) {
        const score = this.fuzzyMatch(query, `${agent.name} ${agent.description} ${agent.tags.join(' ')}`);
        if (score > 0) {
          results.push({
            type: 'agent',
            name: agent.name,
            description: agent.description,
            score,
            path: join(this.arcaneDir, AGENTS_DIR, `${key}.md`),
          });
        }
      }
    }

    // Search roles
    if (!type || type === 'role') {
      for (const [key, role] of Object.entries(this.ecosystem.roles)) {
        const score = this.fuzzyMatch(query, `${role.name} ${role.description} ${role.tags.join(' ')}`);
        if (score > 0) {
          results.push({
            type: 'role',
            name: role.name,
            description: role.description,
            score,
            path: join(this.arcaneDir, ROLES_DIR, `${key}.md`),
          });
        }
      }
    }

    // Search skills
    if (!type || type === 'skill') {
      for (const [key, skill] of Object.entries(this.ecosystem.skills)) {
        const score = this.fuzzyMatch(query, `${skill.name} ${skill.description} ${skill.category || ''} ${skill.tags.join(' ')}`);
        if (score > 0) {
          results.push({
            type: 'skill',
            name: skill.name,
            description: skill.description,
            score,
            path: join(this.arcaneDir, SKILLS_DIR, `${key}.md`),
          });
        }
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Lists all agents, roles, or skills.
   */
  async list(type?: 'agent' | 'role' | 'skill'): Promise<SearchResult[]> {
    await this.loadEcosystem();
    if (!this.ecosystem) {
      return [];
    }

    const results: SearchResult[] = [];

    // List agents
    if (!type || type === 'agent') {
      for (const [key, agent] of Object.entries(this.ecosystem.agents)) {
        results.push({
          type: 'agent',
          name: agent.name,
          description: agent.description,
          score: 1,
          path: join(this.arcaneDir, AGENTS_DIR, `${key}.md`),
        });
      }
    }

    // List roles
    if (!type || type === 'role') {
      for (const [key, role] of Object.entries(this.ecosystem.roles)) {
        results.push({
          type: 'role',
          name: role.name,
          description: role.description,
          score: 1,
          path: join(this.arcaneDir, ROLES_DIR, `${key}.md`),
        });
      }
    }

    // List skills
    if (!type || type === 'skill') {
      for (const [key, skill] of Object.entries(this.ecosystem.skills)) {
        results.push({
          type: 'skill',
          name: skill.name,
          description: skill.description,
          score: 1,
          path: join(this.arcaneDir, SKILLS_DIR, `${key}.md`),
        });
      }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Gets a specific agent by name.
   */
  async getAgent(name: string): Promise<Agent | null> {
    await this.loadEcosystem();
    return this.ecosystem?.agents[name] || null;
  }

  /**
   * Gets a specific role by name.
   */
  async getRole(name: string): Promise<Role | null> {
    await this.loadEcosystem();
    return this.ecosystem?.roles[name] || null;
  }

  /**
   * Gets a specific skill by name.
   */
  async getSkill(name: string): Promise<Skill | null> {
    await this.loadEcosystem();
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

    // Additional validation logic
    if (agent.name.length < 2) {
      result.errors.push('Agent name must be at least 2 characters long');
      result.valid = false;
    }

    if (agent.description.length < 10) {
      result.warnings.push('Agent description is quite short. Consider adding more detail.');
    }

    if (agent.roles.length === 0 && agent.skills.length === 0) {
      result.warnings.push('Agent has no roles or skills assigned. Consider adding some.');
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

    // Additional validation logic
    if (role.name.length < 2) {
      result.errors.push('Role name must be at least 2 characters long');
      result.valid = false;
    }

    if (role.responsibilities.length === 0) {
      result.warnings.push('Role has no responsibilities defined. Consider adding some.');
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
      result.suggestions.push('Consider adding usage examples to help others understand the skill.');
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
      } catch (error) {
        // Directory might already exist
      }
    }
  }

  private async loadEcosystem(): Promise<void> {
    const ecosystemPath = join(this.arcaneDir, 'ecosystem.json');
    
    try {
      const data = await fs.readFile(ecosystemPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.ecosystem = AgentEcosystemSchema.parse(parsed);
    } catch (error) {
      // Create empty ecosystem if file doesn't exist
      this.ecosystem = {
        agents: {},
        roles: {},
        skills: {},
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  private async saveEcosystem(): Promise<void> {
    if (!this.ecosystem) {
      return;
    }

    const ecosystemPath = join(this.arcaneDir, 'ecosystem.json');
    await fs.writeFile(ecosystemPath, JSON.stringify(this.ecosystem, null, 2), 'utf-8');
  }

  private async writeAgentFile(agent: Agent, options: GenerationOptions): Promise<string> {
    const fileName = `${agent.name.toLowerCase().replace(/\s+/g, '-')}.md`;
    const filePath = options.outputDir 
      ? join(options.outputDir, fileName)
      : join(this.arcaneDir, AGENTS_DIR, fileName);

    const content = this.generateAgentMarkdown(agent);

    if (options.dryRun) {
      console.log(`[DRY RUN] Would write agent to: ${filePath}`);
      return filePath;
    }

    // Check if file exists and handle overwrite
    try {
      await fs.access(filePath);
      if (!options.overwrite) {
        throw new Error(`Agent file already exists: ${filePath}. Use --overwrite to replace it.`);
      }
    } catch (error) {
      // If it's not the file existence error, rethrow
      if (error instanceof Error && error.message.includes('already exists')) {
        throw error;
      }
      // File doesn't exist, which is fine
    }

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  private async writeRoleFile(role: Role, options: GenerationOptions): Promise<string> {
    const fileName = `${role.name.toLowerCase().replace(/\s+/g, '-')}.md`;
    const filePath = options.outputDir
      ? join(options.outputDir, fileName)
      : join(this.arcaneDir, ROLES_DIR, fileName);

    const content = this.generateRoleMarkdown(role);

    if (options.dryRun) {
      console.log(`[DRY RUN] Would write role to: ${filePath}`);
      return filePath;
    }

    // Check if file exists and handle overwrite
    try {
      await fs.access(filePath);
      if (!options.overwrite) {
        throw new Error(`Role file already exists: ${filePath}. Use --overwrite to replace it.`);
      }
    } catch (error) {
      // File doesn't exist, which is fine
    }

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  private async writeSkillFile(skill: Skill, options: GenerationOptions): Promise<string> {
    const fileName = `${skill.name.toLowerCase().replace(/\s+/g, '-')}.md`;
    const filePath = options.outputDir
      ? join(options.outputDir, fileName)
      : join(this.arcaneDir, SKILLS_DIR, fileName);

    const content = this.generateSkillMarkdown(skill);

    if (options.dryRun) {
      console.log(`[DRY RUN] Would write skill to: ${filePath}`);
      return filePath;
    }

    // Check if file exists and handle overwrite
    try {
      await fs.access(filePath);
      if (!options.overwrite) {
        throw new Error(`Skill file already exists: ${filePath}. Use --overwrite to replace it.`);
      }
    } catch (error) {
      // File doesn't exist, which is fine
    }

    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  private generateAgentMarkdown(agent: Agent): string {
    const frontmatter = {
      name: agent.name,
      description: agent.description,
      personality: agent.personality,
      roles: agent.roles,
      skills: agent.skills,
      tools: agent.tools,
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      enabled: agent.enabled,
      priority: agent.priority,
      created: agent.created,
      updated: agent.updated,
      version: agent.version,
      tags: agent.tags,
    };

    // Remove undefined values
    Object.keys(frontmatter).forEach(key => {
      if (frontmatter[key as keyof typeof frontmatter] === undefined) {
        delete frontmatter[key as keyof typeof frontmatter];
      }
    });

    const yamlFrontmatter = this.objectToYaml(frontmatter);

    return `---
${yamlFrontmatter}
---

# ${agent.name}

${agent.description}

## Personality

${agent.personality || 'No specific personality defined.'}

## Instructions

${agent.instructions || 'No specific instructions provided.'}

## System Prompt

${agent.systemPrompt || 'No system prompt configured.'}

## Roles

${agent.roles.length > 0 ? agent.roles.map(role => `- ${role}`).join('\n') : 'No roles assigned.'}

## Skills

${agent.skills.length > 0 ? agent.skills.map(skill => `- ${skill}`).join('\n') : 'No skills assigned.'}

## Available Tools

${agent.tools.length > 0 ? agent.tools.map(tool => `- ${tool}`).join('\n') : 'No tools configured.'}

## Configuration

- **Model**: ${agent.model || 'Default'}
- **Temperature**: ${agent.temperature || 'Default'}
- **Max Tokens**: ${agent.maxTokens || 'Default'}
- **Priority**: ${agent.priority}
- **Enabled**: ${agent.enabled ? 'Yes' : 'No'}

## Metadata

${Object.keys(agent.metadata).length > 0 
  ? Object.entries(agent.metadata).map(([key, value]) => `- **${key}**: ${value}`).join('\n')
  : 'No additional metadata.'}

## Tags

${agent.tags.length > 0 ? agent.tags.map(tag => `\`${tag}\``).join(', ') : 'No tags.'}

---

*Agent created on ${new Date(agent.created).toLocaleDateString()}${agent.updated ? `, last updated on ${new Date(agent.updated).toLocaleDateString()}` : ''}*
`;
  }

  private generateRoleMarkdown(role: Role): string {
    const frontmatter = {
      name: role.name,
      description: role.description,
      responsibilities: role.responsibilities,
      requiredSkills: role.requiredSkills,
      optionalSkills: role.optionalSkills,
      permissions: role.permissions,
      restrictions: role.restrictions,
      priority: role.priority,
      created: role.created,
      updated: role.updated,
      version: role.version,
      tags: role.tags,
    };

    const yamlFrontmatter = this.objectToYaml(frontmatter);

    return `---
${yamlFrontmatter}
---

# ${role.name}

${role.description}

## Responsibilities

${role.responsibilities.length > 0 
  ? role.responsibilities.map(resp => `- ${resp}`).join('\n')
  : 'No responsibilities defined.'}

## Required Skills

${role.requiredSkills.length > 0 
  ? role.requiredSkills.map(skill => `- ${skill}`).join('\n')
  : 'No required skills.'}

## Optional Skills

${role.optionalSkills.length > 0 
  ? role.optionalSkills.map(skill => `- ${skill}`).join('\n')
  : 'No optional skills.'}

## Permissions

${role.permissions.length > 0 
  ? role.permissions.map(perm => `- ${perm}`).join('\n')
  : 'No specific permissions.'}

## Restrictions

${role.restrictions.length > 0 
  ? role.restrictions.map(rest => `- ${rest}`).join('\n')
  : 'No specific restrictions.'}

## Configuration

- **Priority**: ${role.priority}

## Tags

${role.tags.length > 0 ? role.tags.map(tag => `\`${tag}\``).join(', ') : 'No tags.'}

---

*Role created on ${new Date(role.created).toLocaleDateString()}${role.updated ? `, last updated on ${new Date(role.updated).toLocaleDateString()}` : ''}*
`;
  }

  private generateSkillMarkdown(skill: Skill): string {
    const frontmatter = {
      name: skill.name,
      description: skill.description,
      level: skill.level,
      category: skill.category,
      prerequisites: skill.prerequisites,
      tools: skill.tools,
      examples: skill.examples,
      restrictions: skill.restrictions,
      created: skill.created,
      updated: skill.updated,
      version: skill.version,
      tags: skill.tags,
    };

    // Remove undefined values
    Object.keys(frontmatter).forEach(key => {
      if (frontmatter[key as keyof typeof frontmatter] === undefined) {
        delete frontmatter[key as keyof typeof frontmatter];
      }
    });

    const yamlFrontmatter = this.objectToYaml(frontmatter);

    return `---
${yamlFrontmatter}
---

# ${skill.name}

${skill.description}

## Level

**${skill.level.charAt(0).toUpperCase() + skill.level.slice(1)}**

${skill.category ? `## Category\n\n${skill.category}\n` : ''}

## Prerequisites

${skill.prerequisites.length > 0 
  ? skill.prerequisites.map(prereq => `- ${prereq}`).join('\n')
  : 'No prerequisites.'}

## Required Tools

${skill.tools.length > 0 
  ? skill.tools.map(tool => `- ${tool}`).join('\n')
  : 'No specific tools required.'}

## Examples

${skill.examples.length > 0 
  ? skill.examples.map(example => `- ${example}`).join('\n')
  : 'No examples provided.'}

## Restrictions

${skill.restrictions.length > 0 
  ? skill.restrictions.map(rest => `- ${rest}`).join('\n')
  : 'No specific restrictions.'}

## Tags

${skill.tags.length > 0 ? skill.tags.map(tag => `\`${tag}\``).join(', ') : 'No tags.'}

---

*Skill created on ${new Date(skill.created).toLocaleDateString()}${skill.updated ? `, last updated on ${new Date(skill.updated).toLocaleDateString()}` : ''}*
`;
  }

  private objectToYaml(obj: any, indent = 0): string {
    const spaces = ' '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          yaml += `${spaces}${key}: []\n`;
        } else {
          yaml += `${spaces}${key}:\n`;
          for (const item of value) {
            yaml += `${spaces}  - ${JSON.stringify(item)}\n`;
          }
        }
      } else if (typeof value === 'object') {
        yaml += `${spaces}${key}:\n`;
        yaml += this.objectToYaml(value, indent + 2);
      } else {
        yaml += `${spaces}${key}: ${JSON.stringify(value)}\n`;
      }
    }

    return yaml;
  }

  private fuzzyMatch(query: string, text: string): number {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Exact match
    if (textLower.includes(queryLower)) {
      return 1.0;
    }

    // Word boundary match
    const words = queryLower.split(' ').filter(w => w.length > 0);
    let matchedWords = 0;
    
    for (const word of words) {
      if (textLower.includes(word)) {
        matchedWords++;
      }
    }

    if (matchedWords > 0) {
      return matchedWords / words.length * 0.8;
    }

    // Character sequence match
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
export async function initializeAgentManager(arcaneDir?: string): Promise<void> {
  const manager = getAgentManager(arcaneDir);
  await manager.initialize();
}
