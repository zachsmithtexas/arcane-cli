/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { darkTheme, Theme } from './theme.js';

const arcaneColors = {
  type: 'dark' as const,
  Background: '#0a0a0f',
  Foreground: '#e8e3ff',
  LightBlue: '#7c88ff',
  AccentBlue: '#4a5cf7',
  AccentPurple: '#9945ff',
  AccentCyan: '#4eb8ff',
  AccentGreen: '#00ff88',
  AccentYellow: '#ffcc00',
  AccentRed: '#ff4757',
  DiffAdded: '#1a4a33',
  DiffRemoved: '#4a1a1a',
  Comment: '#6a5acd',
  Gray: '#8892b0',
  GradientColors: ['#9945ff', '#4a5cf7', '#4eb8ff', '#00ff88'],
};

export const ArcaneTheme: Theme = new Theme(
  'Arcane',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: arcaneColors.Background,
      color: arcaneColors.Foreground,
    },
    'hljs-keyword': {
      color: arcaneColors.AccentPurple,
    },
    'hljs-literal': {
      color: arcaneColors.AccentBlue,
    },
    'hljs-symbol': {
      color: arcaneColors.AccentCyan,
    },
    'hljs-name': {
      color: arcaneColors.AccentBlue,
    },
    'hljs-keyword-esc': {
      color: arcaneColors.AccentPurple,
    },
    'hljs-built_in': {
      color: arcaneColors.AccentGreen,
    },
    'hljs-type': {
      color: arcaneColors.AccentYellow,
    },
    'hljs-class': {
      color: arcaneColors.AccentYellow,
    },
    'hljs-function': {
      color: arcaneColors.AccentCyan,
    },
    'hljs-function-esc': {
      color: arcaneColors.AccentCyan,
    },
    'hljs-title': {
      color: arcaneColors.AccentCyan,
    },
    'hljs-title-esc': {
      color: arcaneColors.AccentCyan,
    },
    'hljs-params': {
      color: arcaneColors.Foreground,
    },
    'hljs-comment': {
      color: arcaneColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-doctag': {
      color: arcaneColors.Comment,
    },
    'hljs-meta': {
      color: arcaneColors.AccentPurple,
    },
    'hljs-meta-keyword': {
      color: arcaneColors.AccentPurple,
    },
    'hljs-meta-string': {
      color: arcaneColors.AccentGreen,
    },
    'hljs-section': {
      color: arcaneColors.AccentYellow,
    },
    'hljs-tag': {
      color: arcaneColors.AccentRed,
    },
    'hljs-name-tag': {
      color: arcaneColors.AccentRed,
    },
    'hljs-attr': {
      color: arcaneColors.AccentYellow,
    },
    'hljs-attribute': {
      color: arcaneColors.AccentYellow,
    },
    'hljs-variable': {
      color: arcaneColors.AccentRed,
    },
    'hljs-template-variable': {
      color: arcaneColors.AccentRed,
    },
    'hljs-template-tag': {
      color: arcaneColors.AccentPurple,
    },
    'hljs-string': {
      color: arcaneColors.AccentGreen,
    },
    'hljs-string-esc': {
      color: arcaneColors.AccentGreen,
    },
    'hljs-operator': {
      color: arcaneColors.AccentCyan,
    },
    'hljs-regexp': {
      color: arcaneColors.AccentGreen,
    },
    'hljs-number': {
      color: arcaneColors.AccentBlue,
    },
    'hljs-addition': {
      color: arcaneColors.AccentGreen,
      background: arcaneColors.DiffAdded,
    },
    'hljs-deletion': {
      color: arcaneColors.AccentRed,
      background: arcaneColors.DiffRemoved,
    },
    'hljs-selector-id': {
      color: arcaneColors.AccentRed,
    },
    'hljs-selector-class': {
      color: arcaneColors.AccentYellow,
    },
    'hljs-selector-attr': {
      color: arcaneColors.AccentYellow,
    },
    'hljs-selector-pseudo': {
      color: arcaneColors.AccentPurple,
    },
    'hljs-property': {
      color: arcaneColors.AccentBlue,
    },
    'hljs-subst': {
      color: arcaneColors.Foreground,
    },
    'hljs-formula': {
      color: arcaneColors.AccentPurple,
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-code': {
      background: arcaneColors.Background,
      color: arcaneColors.Foreground,
    },
    'hljs-bullet': {
      color: arcaneColors.AccentBlue,
    },
    'hljs-quote': {
      color: arcaneColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-link': {
      color: arcaneColors.AccentCyan,
    },
    'hljs-selector-tag': {
      color: arcaneColors.AccentRed,
    },
  },
  arcaneColors,
);
