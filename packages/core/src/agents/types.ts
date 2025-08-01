/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// packages/core/src/agents/types.ts

/**
 * @fileoverview Type definitions for the agent, role, and skill system.
 * 
 * This module defines the core data structures and interfaces for managing
 * AI agents, their roles, and skills within the Arcane CLI system.
 */

import { z } from 'zod';

/**
 * Defines the capability levels for skills.
 */
export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

/**
 * Defines the priority levels for agents and tasks.
 */
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Schema for a skill definition.
 */
export const SkillSchema = z.object({
  name: z.string().nonempty(),
  description: z.string(),
  level: z.nativeEnum(SkillLevel),
  category: z.string().optional(),
  prerequisites: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  examples: z.array(z.string()).default([]),
  restrictions: z.array(z.string()).default([]),
  created: z.string(), // ISO date
  updated: z.string().optional(), // ISO date
  version: z.string().default('1.0.0'),
  tags: z.array(z.string()).default([]),
});

export type Skill = z.infer<typeof SkillSchema>;

/**
 * Schema for a role definition.
 */
export const RoleSchema = z.object({
  name: z.string().nonempty(),
  description: z.string(),
  responsibilities: z.array(z.string()).default([]),
  requiredSkills: z.array(z.string()).default([]),
  optionalSkills: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  restrictions: z.array(z.string()).default([]),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  created: z.string(), // ISO date
  updated: z.string().optional(), // ISO date
  version: z.string().default('1.0.0'),
  tags: z.array(z.string()).default([]),
});

export type Role = z.infer<typeof RoleSchema>;

/**
 * Schema for an agent definition.
 */
export const AgentSchema = z.object({
  name: z.string().nonempty(),
  description: z.string(),
  personality: z.string().optional(),
  instructions: z.string().optional(),
  roles: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  systemPrompt: z.string().optional(),
  enabled: z.boolean().default(true),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  created: z.string(), // ISO date
  updated: z.string().optional(), // ISO date
  version: z.string().default('1.0.0'),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.any()).default({}),
});

export type Agent = z.infer<typeof AgentSchema>;

/**
 * Combined schema for agent ecosystem data.
 */
export const AgentEcosystemSchema = z.object({
  agents: z.record(z.string(), AgentSchema).default({}),
  roles: z.record(z.string(), RoleSchema).default({}),
  skills: z.record(z.string(), SkillSchema).default({}),
  version: z.string().default('1.0.0'),
  lastUpdated: z.string(), // ISO date
});

export type AgentEcosystem = z.infer<typeof AgentEcosystemSchema>;

/**
 * Template for generating new entities.
 */
export interface GenerationTemplate {
  type: 'agent' | 'role' | 'skill';
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  additionalFields?: Record<string, any>;
}

/**
 * Search result for fuzzy matching.
 */
export interface SearchResult {
  type: 'agent' | 'role' | 'skill';
  name: string;
  description: string;
  score: number;
  path: string;
}

/**
 * Generation options for creating new entities.
 */
export interface GenerationOptions {
  interactive: boolean;
  template?: string;
  outputDir?: string;
  dryRun?: boolean;
  overwrite?: boolean;
}

/**
 * Validation result for entity definitions.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}
