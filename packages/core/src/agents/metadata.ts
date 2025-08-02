/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/agents/metadata.ts

/**
 * @fileoverview Enhanced metadata management for agents, roles, and skills.
 *
 * This module provides functionality for managing separate metadata files
 * and supporting directory-based organization with meta.md files.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { Agent, Role, Skill, AgentEcosystem } from './types.js';

/**
 * Metadata file structure for enhanced organization.
 */
export interface MetadataFile {
  path: string;
  frontmatter: Record<string, unknown>;
  content: string;
  lastModified: string;
}

/**
 * Enhanced metadata manager for directory-based organization.
 */
export class MetadataManager {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * Creates an enhanced directory structure for an agent.
   */
  async createAgentDirectory(agent: Agent): Promise<string> {
    const agentSlug = this.slugify(agent.name);
    const agentDir = join(this.basePath, 'agents', agentSlug);

    // Create agent directory
    await fs.mkdir(agentDir, { recursive: true });

    // Create meta.md file
    const metaPath = join(agentDir, 'meta.md');
    const metaContent = this.generateAgentMetadata(agent);
    await fs.writeFile(metaPath, metaContent, 'utf-8');

    // Create main agent file (optional - can reference meta.md)
    const agentPath = join(agentDir, 'agent.md');
    const agentContent = this.generateAgentContent(agent, './meta.md');
    await fs.writeFile(agentPath, agentContent, 'utf-8');

    return agentDir;
  }

  /**
   * Creates an enhanced directory structure for a role.
   */
  async createRoleDirectory(role: Role): Promise<string> {
    const roleSlug = this.slugify(role.name);
    const roleDir = join(this.basePath, 'roles', roleSlug);

    // Create role directory
    await fs.mkdir(roleDir, { recursive: true });

    // Create meta.md file
    const metaPath = join(roleDir, 'meta.md');
    const metaContent = this.generateRoleMetadata(role);
    await fs.writeFile(metaPath, metaContent, 'utf-8');

    // Create main role file
    const rolePath = join(roleDir, 'role.md');
    const roleContent = this.generateRoleContent(role, './meta.md');
    await fs.writeFile(rolePath, roleContent, 'utf-8');

    return roleDir;
  }

  /**
   * Creates an enhanced directory structure for a skill.
   */
  async createSkillDirectory(skill: Skill): Promise<string> {
    const skillSlug = this.slugify(skill.name);
    const skillDir = join(this.basePath, 'skills', skillSlug);

    // Create skill directory
    await fs.mkdir(skillDir, { recursive: true });

    // Create meta.md file
    const metaPath = join(skillDir, 'meta.md');
    const metaContent = this.generateSkillMetadata(skill);
    await fs.writeFile(metaPath, metaContent, 'utf-8');

    // Create main skill file
    const skillPath = join(skillDir, 'skill.md');
    const skillContent = this.generateSkillContent(skill, './meta.md');
    await fs.writeFile(skillPath, skillContent, 'utf-8');

    return skillDir;
  }

  /**
   * Loads agent metadata from meta.md file.
   */
  async loadAgentMetadata(agentName: string): Promise<Agent | null> {
    try {
      const agentSlug = this.slugify(agentName);
      const metaPath = join(this.basePath, 'agents', agentSlug, 'meta.md');

      const content = await fs.readFile(metaPath, 'utf-8');
      const { frontmatter } = this.parseFrontmatter(content);

      return this.frontmatterToAgent(frontmatter);
    } catch (_error) {
      return null;
    }
  }

  /**
   * Loads role metadata from meta.md file.
   */
  async loadRoleMetadata(roleName: string): Promise<Role | null> {
    try {
      const roleSlug = this.slugify(roleName);
      const metaPath = join(this.basePath, 'roles', roleSlug, 'meta.md');

      const content = await fs.readFile(metaPath, 'utf-8');
      const { frontmatter } = this.parseFrontmatter(content);

      return this.frontmatterToRole(frontmatter);
    } catch (_error) {
      return null;
    }
  }

  /**
   * Loads skill metadata from meta.md file.
   */
  async loadSkillMetadata(skillName: string): Promise<Skill | null> {
    try {
      const skillSlug = this.slugify(skillName);
      const metaPath = join(this.basePath, 'skills', skillSlug, 'meta.md');

      const content = await fs.readFile(metaPath, 'utf-8');
      const { frontmatter } = this.parseFrontmatter(content);

      return this.frontmatterToSkill(frontmatter);
    } catch (_error) {
      return null;
    }
  }

  /**
   * Updates agent metadata file.
   */
  async updateAgentMetadata(agentName: string, agent: Agent): Promise<void> {
    const agentSlug = this.slugify(agentName);
    const metaPath = join(this.basePath, 'agents', agentSlug, 'meta.md');

    // Update the updated timestamp
    agent.updated = new Date().toISOString();

    const metaContent = this.generateAgentMetadata(agent);
    await fs.writeFile(metaPath, metaContent, 'utf-8');
  }

  /**
   * Updates role metadata file.
   */
  async updateRoleMetadata(roleName: string, role: Role): Promise<void> {
    const roleSlug = this.slugify(roleName);
    const metaPath = join(this.basePath, 'roles', roleSlug, 'meta.md');

    role.updated = new Date().toISOString();

    const metaContent = this.generateRoleMetadata(role);
    await fs.writeFile(metaPath, metaContent, 'utf-8');
  }

  /**
   * Updates skill metadata file.
   */
  async updateSkillMetadata(skillName: string, skill: Skill): Promise<void> {
    const skillSlug = this.slugify(skillName);
    const metaPath = join(this.basePath, 'skills', skillSlug, 'meta.md');

    skill.updated = new Date().toISOString();

    const metaContent = this.generateSkillMetadata(skill);
    await fs.writeFile(metaPath, metaContent, 'utf-8');
  }

  /**
   * Lists all metadata files of a given type.
   */
  async listMetadataFiles(
    type: 'agents' | 'roles' | 'skills',
  ): Promise<MetadataFile[]> {
    const typeDir = join(this.basePath, type);
    const results: MetadataFile[] = [];

    try {
      const entries = await fs.readdir(typeDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metaPath = join(typeDir, entry.name, 'meta.md');
          try {
            const content = await fs.readFile(metaPath, 'utf-8');
            const { frontmatter } = this.parseFrontmatter(content);
            const stats = await fs.stat(metaPath);

            results.push({
              path: metaPath,
              frontmatter,
              content,
              lastModified: stats.mtime.toISOString(),
            });
          } catch (_error) {
            // Skip directories without meta.md
          }
        }
      }
    } catch (_error) {
      // Directory doesn't exist or can't be read
    }

    return results;
  }

  /**
   * Scans and rebuilds ecosystem from metadata files.
   */
  async rebuildEcosystemFromMetadata(): Promise<AgentEcosystem> {
    const ecosystem: AgentEcosystem = {
      agents: {},
      roles: {},
      skills: {},
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
    };

    // Load agents
    const agentFiles = await this.listMetadataFiles('agents');
    for (const file of agentFiles) {
      try {
        const agent = this.frontmatterToAgent(file.frontmatter);
        if (agent) {
          ecosystem.agents[agent.name] = agent;
        }
      } catch (_error) {
        console.warn(`Failed to load agent from ${file.path}:`, _error);
      }
    }

    // Load roles
    const roleFiles = await this.listMetadataFiles('roles');
    for (const file of roleFiles) {
      try {
        const role = this.frontmatterToRole(file.frontmatter);
        if (role) {
          ecosystem.roles[role.name] = role;
        }
      } catch (_error) {
        console.warn(`Failed to load role from ${file.path}:`, _error);
      }
    }

    // Load skills
    const skillFiles = await this.listMetadataFiles('skills');
    for (const file of skillFiles) {
      try {
        const skill = this.frontmatterToSkill(file.frontmatter);
        if (skill) {
          ecosystem.skills[skill.name] = skill;
        }
      } catch (_error) {
        console.warn(`Failed to load skill from ${file.path}:`, _error);
      }
    }

    return ecosystem;
  }

  /**
   * Generates agent metadata file content.
   */
  private generateAgentMetadata(agent: Agent): string {
    const frontmatter = this.agentToFrontmatter(agent);
    const yamlContent = this.objectToYaml(frontmatter);

    return `---
${yamlContent}
---

# ${agent.name} - Metadata

This file contains the metadata configuration for the **${agent.name}** agent.

## Description
${agent.description}

## Configuration Notes
- Edit this file to update agent metadata
- Changes will be reflected when the agent is reloaded
- Ensure all required fields are present and valid
- Use the CLI command 'gemini edit agent "${agent.name}"' for guided editing

## Metadata Fields
- **name**: Unique identifier for the agent
- **description**: Brief description of the agent's purpose
- **personality**: Agent's personality traits and behavior
- **instructions**: Special instructions for the agent
- **roles**: List of roles assigned to this agent
- **skills**: List of skills the agent possesses
- **tools**: Available tools the agent can use
- **model**: AI model configuration
- **temperature**: Response randomness (0.0 - 2.0)
- **maxTokens**: Maximum response length
- **systemPrompt**: System-level instructions
- **enabled**: Whether the agent is active
- **priority**: Agent priority level
- **tags**: Searchable tags for organization
- **metadata**: Additional custom metadata

---
*Last updated: ${agent.updated || agent.created}*
`;
  }

  /**
   * Generates role metadata file content.
   */
  private generateRoleMetadata(role: Role): string {
    const frontmatter = this.roleToFrontmatter(role);
    const yamlContent = this.objectToYaml(frontmatter);

    return `---
${yamlContent}
---

# ${role.name} - Role Metadata

This file contains the metadata configuration for the **${role.name}** role.

## Description
${role.description}

## Configuration Notes
- Edit this file to update role metadata
- Changes will be reflected when agents using this role are reloaded
- Ensure all required fields are present and valid
- Use the CLI command 'gemini edit role "${role.name}"' for guided editing

## Metadata Fields
- **name**: Unique identifier for the role
- **description**: Brief description of the role's purpose
- **responsibilities**: List of role responsibilities
- **requiredSkills**: Skills that are required for this role
- **optionalSkills**: Skills that are beneficial but not required
- **allowedTools**: List of tools/commands this role is allowed to use
- **restrictedTools**: List of tools/commands this role is explicitly forbidden from using
- **priority**: Role priority level
- **tags**: Searchable tags for organization

---
*Last updated: ${role.updated || role.created}*
`;
  }

  /**
   * Generates skill metadata file content.
   */
  private generateSkillMetadata(skill: Skill): string {
    const frontmatter = this.skillToFrontmatter(skill);
    const yamlContent = this.objectToYaml(frontmatter);

    return `---
${yamlContent}
---

# ${skill.name} - Skill Metadata

This file contains the metadata configuration for the **${skill.name}** skill.

## Description
${skill.description}

## Configuration Notes
- Edit this file to update skill metadata
- Changes will be reflected when agents using this skill are reloaded
- Ensure all required fields are present and valid
- Use the CLI command 'gemini edit skill "${skill.name}"' for guided editing

## Metadata Fields
- **name**: Unique identifier for the skill
- **description**: Brief description of the skill
- **level**: Skill difficulty level (beginner/intermediate/advanced/expert)
- **category**: Skill category for organization
- **prerequisites**: Skills required before learning this skill
- **allowedTools**: Tools/commands granted by this skill
- **restrictedTools**: Tools/commands explicitly forbidden by this skill
- **examples**: Usage examples and use cases
- **tags**: Searchable tags for organization

---
*Last updated: ${skill.updated || skill.created}*
`;
  }

  /**
   * Generates agent content file that references metadata.
   */
  private generateAgentContent(agent: Agent, metaPath: string): string {
    return `# ${agent.name}

> **Metadata**: See [${metaPath}](${metaPath}) for complete configuration.

${agent.description}

## Quick Overview

This agent is configured with the following:
- **Roles**: ${agent.roles.length > 0 ? agent.roles.join(', ') : 'None'}
- **Skills**: ${agent.skills.length > 0 ? agent.skills.join(', ') : 'None'}
- **Tools**: ${agent.tools.length > 0 ? agent.tools.join(', ') : 'None'}
- **Priority**: ${agent.priority}
- **Status**: ${agent.enabled ? 'Enabled' : 'Disabled'}

## Personality
${agent.personality || 'No specific personality defined.'}

## Instructions
${agent.instructions || 'No specific instructions provided.'}

## System Prompt
${agent.systemPrompt || 'No system prompt configured.'}

---

*For complete metadata and configuration, see [meta.md](./meta.md)*

*Agent created: ${new Date(agent.created).toLocaleDateString()}*
${
  agent.updated
    ? `*Last updated: ${new Date(agent.updated).toLocaleDateString()}*`
    : ''
}
`;
  }

  /**
   * Generates role content file that references metadata.
   */
  private generateRoleContent(role: Role, metaPath: string): string {
    return `# ${role.name}

> **Metadata**: See [${metaPath}](${metaPath}) for complete configuration.

${role.description}

## Quick Overview

- **Required Skills**: ${
      role.requiredSkills.length > 0 ? role.requiredSkills.join(', ') : 'None'
    }
- **Optional Skills**: ${
      role.optionalSkills.length > 0 ? role.optionalSkills.join(', ') : 'None'
    }
- **Priority**: ${role.priority}

## Responsibilities
${
  role.responsibilities.length > 0
    ? role.responsibilities.map((resp) => `- ${resp}`).join('\n')
    : 'No responsibilities defined.'
}

## Allowed Tools
${
  role.allowedTools.length > 0
    ? role.allowedTools.map((perm) => `- ${perm}`).join('\n')
    : 'No specific permissions.'
}

## Restricted Tools
${
  role.restrictedTools.length > 0
    ? role.restrictedTools.map((rest) => `- ${rest}`).join('\n')
    : 'No specific restrictions.'
}

---

*For complete metadata and configuration, see [meta.md](./meta.md)*

*Role created: ${new Date(role.created).toLocaleDateString()}*
${
  role.updated
    ? `*Last updated: ${new Date(role.updated).toLocaleDateString()}*`
    : ''
}
`;
  }

  /**
   * Generates skill content file that references metadata.
   */
  private generateSkillContent(skill: Skill, metaPath: string): string {
    return `# ${skill.name}

> **Metadata**: See [${metaPath}](${metaPath}) for complete configuration.

${skill.description}

## Quick Overview

- **Level**: ${skill.level.charAt(0).toUpperCase() + skill.level.slice(1)}
- **Category**: ${skill.category || 'Uncategorized'}

## Prerequisites
${
  skill.prerequisites.length > 0
    ? skill.prerequisites.map((prereq) => `- ${prereq}`).join('\n')
    : 'No prerequisites.'
}

## Allowed Tools
${
  skill.allowedTools.length > 0
    ? skill.allowedTools.map((tool) => `- ${tool}`).join('\n')
    : 'No specific tools required.'
}

## Examples
${
  skill.examples.length > 0
    ? skill.examples.map((example) => `- ${example}`).join('\n')
    : 'No examples provided.'
}

## Restricted Tools
${
  skill.restrictedTools.length > 0
    ? skill.restrictedTools.map((rest) => `- ${rest}`).join('\n')
    : 'No specific restrictions.'
}

---

*For complete metadata and configuration, see [meta.md](./meta.md)*

*Skill created: ${new Date(skill.created).toLocaleDateString()}*
${
  skill.updated
    ? `*Last updated: ${new Date(skill.updated).toLocaleDateString()}*`
    : ''
}
`;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private agentToFrontmatter(agent: Agent): Record<string, unknown> {
    return {
      name: agent.name,
      description: agent.description,
      personality: agent.personality,
      instructions: agent.instructions,
      roles: agent.roles,
      skills: agent.skills,
      tools: agent.tools,
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      systemPrompt: agent.systemPrompt,
      enabled: agent.enabled,
      priority: agent.priority,
      created: agent.created,
      updated: agent.updated,
      version: agent.version,
      tags: agent.tags,
      metadata: agent.metadata,
    };
  }

  private roleToFrontmatter(role: Role): Record<string, unknown> {
    return {
      name: role.name,
      description: role.description,
      responsibilities: role.responsibilities,
      requiredSkills: role.requiredSkills,
      optionalSkills: role.optionalSkills,
      allowedTools: role.allowedTools,
      restrictedTools: role.restrictedTools,
      priority: role.priority,
      created: role.created,
      updated: role.updated,
      version: role.version,
      tags: role.tags,
    };
  }

  private skillToFrontmatter(skill: Skill): Record<string, unknown> {
    return {
      name: skill.name,
      description: skill.description,
      level: skill.level,
      category: skill.category,
      prerequisites: skill.prerequisites,
      allowedTools: skill.allowedTools,
      restrictedTools: skill.restrictedTools,
      examples: skill.examples,
      created: skill.created,
      updated: skill.updated,
      version: skill.version,
      tags: skill.tags,
    };
  }

  private frontmatterToAgent(
    frontmatter: Record<string, unknown>,
  ): Agent | null {
    try {
      // Require name and description for valid agent
      const name = frontmatter.name as string;
      const description = frontmatter.description as string;

      if (!name || !description) {
        return null;
      }

      return {
        name,
        description,
        personality: frontmatter.personality as string | undefined,
        instructions: frontmatter.instructions as string | undefined,
        roles: (frontmatter.roles as string[]) || [],
        skills: (frontmatter.skills as string[]) || [],
        tools: (frontmatter.tools as string[]) || [],
        model: frontmatter.model as string | undefined,
        temperature: frontmatter.temperature as number | undefined,
        maxTokens: frontmatter.maxTokens as number | undefined,
        systemPrompt: frontmatter.systemPrompt as string | undefined,
        enabled: (frontmatter.enabled as boolean) ?? true,
        priority: (frontmatter.priority as Agent['priority']) || 'medium',
        created: (frontmatter.created as string) || new Date().toISOString(),
        updated: frontmatter.updated as string | undefined,
        version: (frontmatter.version as string) || '1.0.0',
        tags: (frontmatter.tags as string[]) || [],
        metadata: (frontmatter.metadata as Record<string, unknown>) || {},
      };
    } catch (_error) {
      return null;
    }
  }

  private frontmatterToRole(frontmatter: Record<string, unknown>): Role | null {
    try {
      return {
        name: (frontmatter.name as string) || '',
        description: (frontmatter.description as string) || '',
        responsibilities: (frontmatter.responsibilities as string[]) || [],
        requiredSkills: (frontmatter.requiredSkills as string[]) || [],
        optionalSkills: (frontmatter.optionalSkills as string[]) || [],
        allowedTools: (frontmatter.allowedTools as string[]) || [],
        restrictedTools: (frontmatter.restrictedTools as string[]) || [],
        priority: (frontmatter.priority as Role['priority']) || 'medium',
        created: (frontmatter.created as string) || new Date().toISOString(),
        updated: frontmatter.updated as string | undefined,
        version: (frontmatter.version as string) || '1.0.0',
        tags: (frontmatter.tags as string[]) || [],
      };
    } catch (_error) {
      return null;
    }
  }

  private frontmatterToSkill(
    frontmatter: Record<string, unknown>,
  ): Skill | null {
    try {
      return {
        name: (frontmatter.name as string) || '',
        description: (frontmatter.description as string) || '',
        level: (frontmatter.level as Skill['level']) || 'beginner',
        category: frontmatter.category as string | undefined,
        prerequisites: (frontmatter.prerequisites as string[]) || [],
        allowedTools: (frontmatter.allowedTools as string[]) || [],
        restrictedTools: (frontmatter.restrictedTools as string[]) || [],
        examples: (frontmatter.examples as string[]) || [],
        created: (frontmatter.created as string) || new Date().toISOString(),
        updated: frontmatter.updated as string | undefined,
        version: (frontmatter.version as string) || '1.0.0',
        tags: (frontmatter.tags as string[]) || [],
      };
    } catch (_error) {
      return null;
    }
  }

  private parseFrontmatter(content: string): {
    frontmatter: Record<string, unknown>;
    body: string;
  } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
      return { frontmatter: {}, body: content };
    }

    try {
      // Simple YAML parser for frontmatter
      const frontmatter = this.parseSimpleYaml(match[1]);
      return { frontmatter, body: match[2] };
    } catch (_error) {
      return { frontmatter: {}, body: content };
    }
  }

  private parseSimpleYaml(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      try {
        result[key] = JSON.parse(value);
      } catch {
        // If JSON parse fails, treat as string and remove quotes
        result[key] = value.replace(/^["']|["']$/g, '');
      }
    }

    return result;
  }

  private objectToYaml(obj: Record<string, unknown>, indent = 0): string {
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
        yaml += this.objectToYaml(value as Record<string, unknown>, indent + 2);
      } else {
        yaml += `${spaces}${key}: ${JSON.stringify(value)}\n`;
      }
    }

    return yaml;
  }
}
