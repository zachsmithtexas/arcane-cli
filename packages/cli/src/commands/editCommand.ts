/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/cli/src/commands/editCommand.ts

/**
 * @fileoverview CLI command for editing agent, role, and skill metadata.
 *
 * This module provides CLI interface for editing metadata files using
 * external text editors or guided prompts.
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  getAgentManager,
  initializeAgentManager,
  MetadataManager,
  DEFAULT_ARCANE_DIR,
  Agent,
  Role,
  Skill,
} from '@google/gemini-cli-core';

/**
 * CLI arguments for the edit command.
 */
export interface EditArgs {
  type: 'agent' | 'role' | 'skill';
  name: string;
  editor?: string;
  interactive?: boolean;
  field?: string;
  value?: string;
  validate?: boolean;
}

/**
 * Handles the edit command execution.
 */
export async function handleEditCommand(args: EditArgs): Promise<void> {
  try {
    // Initialize agent manager and metadata manager
    await initializeAgentManager();
    const agentManager = getAgentManager();
    const metadataManager = agentManager.getMetadataManager();

    if (args.field && args.value) {
      await handleFieldEdit(metadataManager, args);
    } else if (args.interactive) {
      await handleInteractiveEdit(metadataManager, args);
    } else {
      await handleEditorEdit(args);
    }
  } catch (error) {
    console.error(
      '❌ Edit failed:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

/**
 * Handles editing a specific field value.
 */
async function handleFieldEdit(
  metadataManager: MetadataManager,
  args: EditArgs,
): Promise<void> {
  console.log(
    `🔧 Updating ${args.type} "${args.name}" field "${args.field}" to "${args.value}"`,
  );

  let entity: Agent | Role | Skill | null;
  switch (args.type) {
    case 'agent':
      entity = await metadataManager.loadAgentMetadata(args.name);
      break;
    case 'role':
      entity = await metadataManager.loadRoleMetadata(args.name);
      break;
    case 'skill':
      entity = await metadataManager.loadSkillMetadata(args.name);
      break;
    default:
      throw new Error(`Invalid entity type: ${args.type}`);
  }

  if (!entity) {
    throw new Error(`${args.type} "${args.name}" not found`);
  }

  const fieldPath = args.field!.split('.');
  let current: Record<string, unknown> = entity;

  for (let i = 0; i < fieldPath.length - 1; i++) {
    const key = fieldPath[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const finalField = fieldPath[fieldPath.length - 1];

  let parsedValue: unknown = args.value;
  try {
    parsedValue = JSON.parse(args.value!);
  } catch {
    // Keep as string if JSON parsing fails
  }

  current[finalField] = parsedValue;

  switch (args.type) {
    case 'agent':
      await metadataManager.updateAgentMetadata(args.name, entity as Agent);
      break;
    case 'role':
      await metadataManager.updateRoleMetadata(args.name, entity as Role);
      break;
    case 'skill':
      await metadataManager.updateSkillMetadata(args.name, entity as Skill);
      break;
    default:
      throw new Error(`Invalid entity type: ${args.type}`);
  }

  console.log(`✅ Updated ${args.type} "${args.name}" field "${args.field}"`);

  if (args.validate) {
    await validateEntity(metadataManager, args.type, args.name);
  }
}

/**
 * Handles interactive editing with prompts.
 */
async function handleInteractiveEdit(
  metadataManager: MetadataManager,
  args: EditArgs,
): Promise<void> {
  console.log(`🔧 Interactive editing for ${args.type} "${args.name}"`);

  let entity: Agent | Role | Skill | null;
  switch (args.type) {
    case 'agent':
      entity = await metadataManager.loadAgentMetadata(args.name);
      break;
    case 'role':
      entity = await metadataManager.loadRoleMetadata(args.name);
      break;
    case 'skill':
      entity = await metadataManager.loadSkillMetadata(args.name);
      break;
    default:
      throw new Error(`Invalid entity type: ${args.type}`);
  }

  if (!entity) {
    throw new Error(`${args.type} "${args.name}" not found`);
  }

  console.log('\nCurrent values:');
  printEntitySummary(entity, args.type);

  console.log('\nAvailable fields to edit:');
  const fields = getEditableFields(args.type);
  fields.forEach((field, index) => {
    console.log(`  ${index + 1}. ${field.name} - ${field.description}`);
  });

  console.log(
    '\nEnter the number of the field to edit (or press Enter to finish):',
  );
  console.log(
    '📝 Interactive editing would continue here with proper prompts...',
  );
  console.log('💡 Use --editor to open in your preferred text editor instead.');
}

/**
 * Handles editing with external text editor.
 */
async function handleEditorEdit(args: EditArgs): Promise<void> {
  const editor =
    args.editor || process.env.EDITOR || process.env.VISUAL || 'nano';

  console.log(`📝 Opening ${args.type} "${args.name}" in ${editor}...`);

  const slug = slugify(args.name);
  const metaPath = join(DEFAULT_ARCANE_DIR, `${args.type}s`, slug, 'meta.md');

  try {
    await fs.access(metaPath);
  } catch (_error) {
    throw new Error(`Metadata file not found: ${metaPath}`);
  }

  const editorProcess = spawn(editor, [metaPath], {
    stdio: 'inherit',
    shell: true,
  });

  editorProcess.on('close', async (code) => {
    if (code === 0) {
      console.log('✅ File saved successfully!');
      if (args.validate) {
        const agentManager = getAgentManager();
        const metadataManager = agentManager.getMetadataManager();
        await validateEntity(metadataManager, args.type, args.name);
      }
      console.log(
        `💡 Changes to ${args.type} "${args.name}" will take effect when reloaded.`,
      );
    } else {
      console.error(`❌ Editor exited with code ${code}`);
      process.exit(1);
    }
  });

  editorProcess.on('error', (error) => {
    console.error(`❌ Failed to open editor: ${error.message}`);
    process.exit(1);
  });
}

/**
 * Validates an entity after editing.
 */
async function validateEntity(
  metadataManager: MetadataManager,
  type: 'agent' | 'role' | 'skill',
  name: string,
): Promise<void> {
  console.log(`🔍 Validating ${type} "${name}"...`);

  try {
    let entity: Agent | Role | Skill | null;
    switch (type) {
      case 'agent':
        entity = await metadataManager.loadAgentMetadata(name);
        break;
      case 'role':
        entity = await metadataManager.loadRoleMetadata(name);
        break;
      case 'skill':
        entity = await metadataManager.loadSkillMetadata(name);
        break;
      default:
        throw new Error(`Invalid entity type: ${type}`);
    }

    if (!entity) {
      console.error(`❌ Failed to load ${type} after editing`);
      return;
    }

    if (!entity.name || !entity.description) {
      console.error('❌ Validation failed: name and description are required');
      return;
    }

    console.log('✅ Validation passed!');
  } catch (error) {
    console.error(
      `❌ Validation failed: ${error instanceof Error ? error.message : error}`,
    );
  }
}

/**
 * Prints a summary of an entity.
 */
function printEntitySummary(
  entity: Agent | Role | Skill,
  type: 'agent' | 'role' | 'skill',
): void {
  console.log(`  Name: ${entity.name}`);
  console.log(`  Description: ${entity.description}`);

  if (type === 'agent') {
    const agent = entity as Agent;
    console.log(`  Personality: ${agent.personality || 'Not set'}`);
    console.log(
      `  Roles: ${agent.roles?.length ? agent.roles.join(', ') : 'None'}`,
    );
    console.log(
      `  Skills: ${agent.skills?.length ? agent.skills.join(', ') : 'None'}`,
    );
    console.log(
      `  Tools: ${agent.tools?.length ? agent.tools.join(', ') : 'None'}`,
    );
    console.log(`  Enabled: ${agent.enabled ? 'Yes' : 'No'}`);
    console.log(`  Priority: ${agent.priority}`);
  } else if (type === 'role') {
    const role = entity as Role;
    console.log(`  Responsibilities: ${role.responsibilities?.length || 0}`);
    console.log(
      `  Required Skills: ${
        role.requiredSkills?.length ? role.requiredSkills.join(', ') : 'None'
      }`,
    );
    console.log(
      `  Optional Skills: ${
        role.optionalSkills?.length ? role.optionalSkills.join(', ') : 'None'
      }`,
    );
    console.log(`  Priority: ${role.priority}`);
  } else if (type === 'skill') {
    const skill = entity as Skill;
    console.log(`  Level: ${skill.level}`);
    console.log(`  Category: ${skill.category || 'Not set'}`);
    console.log(
      `  Prerequisites: ${
        skill.prerequisites?.length ? skill.prerequisites.join(', ') : 'None'
      }`,
    );
    console.log(
      `  Tools: ${skill.tools?.length ? skill.tools.join(', ') : 'None'}`,
    );
  }

  console.log(
    `  Tags: ${entity.tags?.length ? entity.tags.join(', ') : 'None'}`,
  );
  console.log(`  Created: ${new Date(entity.created).toLocaleDateString()}`);
  if (entity.updated) {
    console.log(`  Updated: ${new Date(entity.updated).toLocaleDateString()}`);
  }
}

/**
 * Gets editable fields for a given type.
 */
function getEditableFields(
  type: string,
): Array<{ name: string; description: string }> {
  const commonFields = [
    { name: 'name', description: 'Entity name' },
    { name: 'description', description: 'Entity description' },
    { name: 'tags', description: 'Searchable tags (JSON array)' },
  ];

  switch (type) {
    case 'agent':
      return [
        ...commonFields,
        { name: 'personality', description: 'Agent personality traits' },
        { name: 'instructions', description: 'Special instructions' },
        { name: 'systemPrompt', description: 'System-level prompt' },
        { name: 'roles', description: 'Assigned roles (JSON array)' },
        { name: 'skills', description: 'Agent skills (JSON array)' },
        { name: 'tools', description: 'Available tools (JSON array)' },
        { name: 'model', description: 'AI model name' },
        { name: 'temperature', description: 'Response randomness (0.0-2.0)' },
        { name: 'maxTokens', description: 'Maximum response length' },
        {
          name: 'enabled',
          description: 'Whether agent is active (true/false)',
        },
        {
          name: 'priority',
          description: 'Priority level (low/medium/high/critical)',
        },
      ];
    case 'role':
      return [
        ...commonFields,
        {
          name: 'responsibilities',
          description: 'Role responsibilities (JSON array)',
        },
        { name: 'requiredSkills', description: 'Required skills (JSON array)' },
        { name: 'optionalSkills', description: 'Optional skills (JSON array)' },
        { name: 'permissions', description: 'Role permissions (JSON array)' },
        { name: 'restrictions', description: 'Role restrictions (JSON array)' },
        {
          name: 'priority',
          description: 'Priority level (low/medium/high/critical)',
        },
      ];
    case 'skill':
      return [
        ...commonFields,
        {
          name: 'level',
          description: 'Skill level (beginner/intermediate/advanced/expert)',
        },
        { name: 'category', description: 'Skill category' },
        {
          name: 'prerequisites',
          description: 'Required prerequisites (JSON array)',
        },
        { name: 'tools', description: 'Required tools (JSON array)' },
        { name: 'examples', description: 'Usage examples (JSON array)' },
        {
          name: 'restrictions',
          description: 'Usage restrictions (JSON array)',
        },
      ];
    default:
      return commonFields;
  }
}

/**
 * Converts text to URL-friendly slug.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Shows usage help for the edit command.
 */
export function showEditHelp(): void {
  console.log(`
✏️  Agent/Role/Skill Metadata Editor

USAGE:
  gemini edit <type> <name> [options]

TYPES:
  agent    🤖 Edit agent metadata
  role     👔 Edit role metadata  
  skill    🎯 Edit skill metadata

OPTIONS:
  --editor <name>        Use specific editor (default: $EDITOR)
  --interactive          Use interactive prompts for editing
  --field <name>         Edit specific field
  --value <value>        Set field value (requires --field)
  --validate             Validate metadata after editing

EXAMPLES:
  # Open agent metadata in default editor
  gemini edit agent "Developer Bot"

  # Use specific editor
  gemini edit agent "Developer Bot" --editor vim

  # Edit specific field
  gemini edit agent "Developer Bot" --field enabled --value false

  # Edit array field (JSON format)
  gemini edit agent "Developer Bot" --field roles --value '["developer", "reviewer"]'

  # Interactive editing
  gemini edit role "Code Reviewer" --interactive

  # Edit with validation
  gemini edit skill "Programming" --field level --value advanced --validate

FIELD EXAMPLES:
  Agent Fields:    name, description, personality, roles, skills, tools, enabled
  Role Fields:     name, description, responsibilities, requiredSkills, permissions  
  Skill Fields:    name, description, level, category, prerequisites, examples

METADATA FILES:
  Metadata is stored in:
  ~/.arcane/agents/[name]/meta.md
  ~/.arcane/roles/[name]/meta.md
  ~/.arcane/skills/[name]/meta.md

For complex edits, use your preferred text editor directly on the meta.md files.
`);
}
