/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/cli/src/commands/generateCommand.ts

/**
 * @fileoverview CLI command for generating agents, roles, and skills.
 * 
 * This module provides the CLI interface for the agent generation system
 * with interactive prompts and template support.
 */

import { 
  getAgentManager, 
  initializeAgentManager,
  InteractiveGenerator,
  PromptInterface,
  AGENT_TEMPLATES,
  ROLE_TEMPLATES,
  SKILL_TEMPLATES,
  GenerationTemplate,
  GenerationOptions,
} from '@google/gemini-cli-core';

/**
 * Simple prompt interface implementation using basic console I/O.
 * In a real implementation, this would use a library like prompts or inquirer.
 */
class ConsolePromptInterface implements PromptInterface {
  async text(message: string, initial?: string): Promise<string> {
    // This is a simplified implementation
    // In practice, you'd use a proper prompting library
    process.stdout.write(`${message} ${initial ? `(${initial}) ` : ''}`);
    
    return new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        const input = data.toString().trim();
        resolve(input || initial || '');
      });
    });
  }

  async confirm(message: string, initial?: boolean): Promise<boolean> {
    const defaultText = initial === undefined ? '' : initial ? ' (Y/n)' : ' (y/N)';
    process.stdout.write(`${message}${defaultText} `);
    
    return new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        const input = data.toString().trim().toLowerCase();
        if (!input) {
          resolve(initial ?? false);
        } else {
          resolve(input === 'y' || input === 'yes');
        }
      });
    });
  }

  async select(message: string, choices: Array<{ title: string; value: any }>): Promise<any> {
    console.log(message);
    choices.forEach((choice, index) => {
      console.log(`  ${index + 1}. ${choice.title}`);
    });
    
    process.stdout.write('Select option (number): ');
    
    return new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        const input = parseInt(data.toString().trim(), 10);
        if (input >= 1 && input <= choices.length) {
          resolve(choices[input - 1].value);
        } else {
          console.log('Invalid selection, using first option');
          resolve(choices[0].value);
        }
      });
    });
  }

  async multiselect(message: string, choices: Array<{ title: string; value: any; selected?: boolean }>): Promise<any[]> {
    console.log(message);
    console.log('Enter numbers separated by commas (e.g., 1,3,5) or press Enter for none:');
    
    choices.forEach((choice, index) => {
      console.log(`  ${index + 1}. ${choice.title}`);
    });
    
    process.stdout.write('Select options: ');
    
    return new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        const input = data.toString().trim();
        if (!input) {
          resolve([]);
          return;
        }
        
        const selected: any[] = [];
        const indices = input.split(',').map(s => parseInt(s.trim(), 10));
        
        for (const index of indices) {
          if (index >= 1 && index <= choices.length) {
            selected.push(choices[index - 1].value);
          }
        }
        
        resolve(selected);
      });
    });
  }

  async number(message: string, initial?: number, min?: number, max?: number): Promise<number> {
    const constraints = [];
    if (min !== undefined) constraints.push(`min: ${min}`);
    if (max !== undefined) constraints.push(`max: ${max}`);
    const constraintText = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
    
    process.stdout.write(`${message}${constraintText} ${initial !== undefined ? `(${initial}) ` : ''}`);
    
    return new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        const input = parseFloat(data.toString().trim());
        
        if (isNaN(input)) {
          resolve(initial ?? 0);
          return;
        }
        
        if (min !== undefined && input < min) {
          console.log(`Value too low, using minimum: ${min}`);
          resolve(min);
          return;
        }
        
        if (max !== undefined && input > max) {
          console.log(`Value too high, using maximum: ${max}`);
          resolve(max);
          return;
        }
        
        resolve(input);
      });
    });
  }
}

/**
 * CLI arguments for the generate command.
 */
export interface GenerateArgs {
  type: 'agent' | 'role' | 'skill';
  name?: string;
  template?: string;
  interactive?: boolean;
  list?: boolean;
  search?: string;
  output?: string;
  dryRun?: boolean;
  overwrite?: boolean;
}

/**
 * Handles the generate command execution.
 */
export async function handleGenerateCommand(args: GenerateArgs): Promise<void> {
  try {
    // Initialize agent manager
    await initializeAgentManager();
    const agentManager = getAgentManager();
    
    // Handle list command
    if (args.list) {
      await handleListCommand(agentManager, args.type);
      return;
    }
    
    // Handle search command
    if (args.search) {
      await handleSearchCommand(agentManager, args.search, args.type);
      return;
    }
    
    // Handle generation
    const options: GenerationOptions = {
      interactive: args.interactive ?? true,
      template: args.template,
      outputDir: args.output,
      dryRun: args.dryRun ?? false,
      overwrite: args.overwrite ?? false,
    };
    
    if (args.interactive) {
      await handleInteractiveGeneration(agentManager, args.type, options);
    } else {
      await handleNonInteractiveGeneration(agentManager, args, options);
    }
    
  } catch (error) {
    console.error('❌ Generation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Handles interactive generation with prompts.
 */
async function handleInteractiveGeneration(
  agentManager: any, 
  type: 'agent' | 'role' | 'skill', 
  options: GenerationOptions
): Promise<void> {
  const promptInterface = new ConsolePromptInterface();
  const generator = new InteractiveGenerator(promptInterface, agentManager);
  
  let filePath: string;
  
  switch (type) {
    case 'agent':
      filePath = await generator.generateAgent(options);
      break;
    case 'role':
      filePath = await generator.generateRole(options);
      break;
    case 'skill':
      filePath = await generator.generateSkill(options);
      break;
    default:
      throw new Error(`Unknown type: ${type}`);
  }
  
  if (options.dryRun) {
    console.log(`\n✅ Dry run completed. ${type} would be created at: ${filePath}`);
  } else {
    console.log(`\n✅ ${type.charAt(0).toUpperCase() + type.slice(1)} created successfully!`);
    console.log(`📄 File: ${filePath}`);
  }
}

/**
 * Handles non-interactive generation using templates or provided data.
 */
async function handleNonInteractiveGeneration(
  agentManager: any,
  args: GenerateArgs,
  options: GenerationOptions
): Promise<void> {
  if (!args.name) {
    throw new Error('Name is required for non-interactive generation');
  }
  
  let template: GenerationTemplate;
  
  if (args.template) {
    template = getTemplate(args.type, args.template, args.name);
  } else {
    // Create basic template
    template = {
      type: args.type,
      name: args.name,
      description: `A ${args.type} named ${args.name}`,
      tags: [],
    };
  }
  
  let filePath: string;
  
  switch (args.type) {
    case 'agent':
      filePath = await agentManager.createAgent(template, options);
      break;
    case 'role':
      filePath = await agentManager.createRole(template, options);
      break;
    case 'skill':
      filePath = await agentManager.createSkill(template, options);
      break;
    default:
      throw new Error(`Unknown type: ${args.type}`);
  }
  
  if (options.dryRun) {
    console.log(`✅ Dry run completed. ${args.type} would be created at: ${filePath}`);
  } else {
    console.log(`✅ ${args.type.charAt(0).toUpperCase() + args.type.slice(1)} '${args.name}' created successfully!`);
    console.log(`📄 File: ${filePath}`);
  }
}

/**
 * Handles the list command.
 */
async function handleListCommand(agentManager: any, type?: 'agent' | 'role' | 'skill'): Promise<void> {
  const results = await agentManager.list(type);
  
  if (results.length === 0) {
    console.log(`No ${type || 'items'} found.`);
    return;
  }
  
  console.log(`\n📋 Available ${type || 'items'}:\n`);
  
  const grouped = results.reduce((acc: Record<string, any[]>, item: any) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {});
  
  for (const [itemType, items] of Object.entries(grouped)) {
    const icon = itemType === 'agent' ? '🤖' : itemType === 'role' ? '👔' : '🎯';
    console.log(`${icon} ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}s:`);
    
    (items as any[]).forEach((item: any) => {
      console.log(`  • ${item.name} - ${item.description}`);
    });
    
    console.log();
  }
}

/**
 * Handles the search command.
 */
async function handleSearchCommand(
  agentManager: any, 
  query: string, 
  type?: 'agent' | 'role' | 'skill'
): Promise<void> {
  const results = await agentManager.search(query, type);
  
  if (results.length === 0) {
    console.log(`No results found for "${query}".`);
    return;
  }
  
  console.log(`\n🔍 Search results for "${query}":\n`);
  
  results.forEach((result: any, index: number) => {
    const icon = result.type === 'agent' ? '🤖' : result.type === 'role' ? '👔' : '🎯';
    const score = Math.round(result.score * 100);
    console.log(`${index + 1}. ${icon} ${result.name} (${score}% match)`);
    console.log(`   ${result.description}`);
    console.log(`   📄 ${result.path}\n`);
  });
}

/**
 * Gets a template by name and type.
 */
function getTemplate(type: 'agent' | 'role' | 'skill', templateName: string, name: string): GenerationTemplate {
  let templates: Record<string, Partial<GenerationTemplate>>;
  
  switch (type) {
    case 'agent':
      templates = AGENT_TEMPLATES;
      break;
    case 'role':
      templates = ROLE_TEMPLATES;
      break;
    case 'skill':
      templates = SKILL_TEMPLATES;
      break;
    default:
      throw new Error(`Unknown type: ${type}`);
  }
  
  const template = templates[templateName];
  if (!template) {
    const available = Object.keys(templates).join(', ');
    throw new Error(`Template '${templateName}' not found. Available templates: ${available}`);
  }
  
  return {
    type,
    name,
    description: template.description || `A ${type} named ${name}`,
    category: template.category,
    tags: template.tags || [],
    additionalFields: template.additionalFields || {},
  };
}

/**
 * Lists available templates for a given type.
 */
export function listTemplates(type: 'agent' | 'role' | 'skill'): void {
  let templates: Record<string, Partial<GenerationTemplate>>;
  let icon: string;
  
  switch (type) {
    case 'agent':
      templates = AGENT_TEMPLATES;
      icon = '🤖';
      break;
    case 'role':
      templates = ROLE_TEMPLATES;
      icon = '👔';
      break;
    case 'skill':
      templates = SKILL_TEMPLATES;
      icon = '🎯';
      break;
    default:
      throw new Error(`Unknown type: ${type}`);
  }
  
  console.log(`\n${icon} Available ${type} templates:\n`);
  
  Object.entries(templates).forEach(([name, template]) => {
    console.log(`• ${name}`);
    if (template.description) {
      console.log(`  ${template.description}`);
    }
    if (template.tags && template.tags.length > 0) {
      console.log(`  Tags: ${template.tags.join(', ')}`);
    }
    console.log();
  });
}

/**
 * Shows usage help for the generate command.
 */
export function showGenerateHelp(): void {
  console.log(`
🚀 Agent/Role/Skill Generator

USAGE:
  gemini generate <type> [options]

TYPES:
  agent    🤖 Create a new AI agent
  role     👔 Create a new role definition  
  skill    🎯 Create a new skill definition

OPTIONS:
  --name <n>         Name for the new item (required for non-interactive)
  --template <n>     Use a predefined template
  --interactive         Use interactive prompts (default: true)
  --no-interactive      Skip interactive prompts
  --list               List existing items of the specified type
  --search <query>     Search existing items
  --output <dir>       Output directory (default: ~/.arcane)
  --dry-run           Show what would be created without creating files
  --overwrite         Overwrite existing files

EXAMPLES:
  # Interactive agent creation
  gemini generate agent

  # Create agent from template
  gemini generate agent --name "MyBot" --template developer

  # List all existing agents
  gemini generate agent --list

  # Search for skills related to "coding"
  gemini generate skill --search coding

  # Create role with custom output directory
  gemini generate role --name "Reviewer" --output ./my-agents

TEMPLATES:
  Agent Templates:    developer, analyst, writer, researcher
  Role Templates:     project-manager, code-reviewer, technical-writer
  Skill Templates:    programming, data-analysis, technical-writing, code-review

For more information about templates:
  gemini generate <type> --template help
`);
}
