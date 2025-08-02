/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render } from 'ink';
import { AppWrapper } from './ui/App.js';
import { loadCliConfig, parseArguments, CliArgs } from './config/config.js';
import { readStdin } from './utils/readStdin.js';
import { basename } from 'node:path';
import v8 from 'node:v8';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { start_sandbox } from './utils/sandbox.js';
import {
  LoadedSettings,
  loadSettings,
  SettingScope,
} from './config/settings.js';
import { themeManager } from './ui/themes/theme-manager.js';
import { getStartupWarnings } from './utils/startupWarnings.js';
import { getUserStartupWarnings } from './utils/userStartupWarnings.js';
import { runNonInteractive } from './nonInteractiveCli.js';
import { loadExtensions, Extension } from './config/extension.js';
import { cleanupCheckpoints, registerCleanup } from './utils/cleanup.js';
import { getCliVersion } from './utils/version.js';
import {
  ApprovalMode,
  Config,
  EditTool,
  ShellTool,
  WriteFileTool,
  sessionId,
  logUserPrompt,
  AuthType,
  getOauthClient,
  ProvidersConfig,
  ProviderConfig,
} from '@google/gemini-cli-core';
import { validateAuthMethod } from './config/auth.js';
import { setMaxSizedBoxDebugging } from './ui/components/shared/MaxSizedBox.js';
import { validateNonInteractiveAuth } from './validateNonInterActiveAuth.js';
import { checkForUpdates } from './ui/utils/updateCheck.js';
import { handleAutoUpdate } from './utils/handleAutoUpdate.js';
import { appEvents, AppEvent } from './utils/events.js';
import { promises as fs } from 'fs';
import { resolve } from 'path';

async function handleProviderCommand(argv: CliArgs) {
  const configPath = resolve(process.cwd(), 'providers.json');
  let config: ProvidersConfig;
  try {
    const file = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(file) as ProvidersConfig;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      config = { providers: [], fallbackOrder: [] };
    } else {
      throw error;
    }
  }

  switch (argv.action) {
    case 'list': {
      console.log('Available providers:');
      if (config.providers.length === 0) {
        console.log('  No providers configured.');
      } else {
        config.providers.forEach((provider: ProviderConfig) => {
          const keyCount = provider.apiKeys
            ? provider.apiKeys.length
            : provider.apiKey
              ? 1
              : 0;
          const status = provider.enabled ? '✅ enabled' : '❌ disabled';
          console.log(`  - ${provider.id} (${keyCount} keys) - ${status}`);
        });
      }
      if (config.fallbackOrder && config.fallbackOrder.length > 0) {
        console.log('Fallback order:', config.fallbackOrder.join(' → '));
      }
      break;
    }
    case 'list-models': {
      const providerId = argv.id;
      if (!providerId) {
        throw new Error('Provider ID is required for list-models command. Usage: provider list-models <provider>');
      }
      
      const provider = config.providers.find((p: ProviderConfig) => p.id === providerId);
      if (!provider) {
        throw new Error(`Provider '${providerId}' not found. Run 'provider list' to see available providers.`);
      }
      
      console.log(`Available models for provider '${providerId}':`);
      
      // For now, provide common model lists for known providers
      const modelLists: Record<string, string[]> = {
        'gemini': [
          'gemini-1.5-pro',
          'gemini-1.5-flash',
          'gemini-1.0-pro',
          'gemini-1.0-pro-vision'
        ],
        'openrouter': [
          'openai/gpt-4',
          'openai/gpt-4o',
          'openai/gpt-3.5-turbo',
          'anthropic/claude-3-opus',
          'anthropic/claude-3-sonnet',
          'anthropic/claude-3-haiku',
          'meta-llama/llama-2-70b-chat',
          'deepseek/deepseek-r1',
          'deepseek/deepseek-r1:free',
          'deepseek/deepseek-chat',
          'deepseek/deepseek-coder',
          'google/gemini-pro',
          'mistralai/mistral-7b-instruct:free',
          'qwen/qwen-2-72b-instruct'
        ],
        'groq': [
          'llama2-70b-4096',
          'mixtral-8x7b-32768',
          'gemma-7b-it'
        ]
      };
      
      const models = modelLists[providerId];
      if (models) {
        models.forEach((model) => {
          console.log(`  - ${model}`);
        });
      } else {
        console.log(`  Model list not available for provider '${providerId}'.`);
        console.log('  Please check the provider documentation for available models.');
      }
      break;
    }
    case 'set': {
      const providerId = argv.id;
      if (!providerId) {
        throw new Error('Provider ID is required to set the active provider.');
      }
      config.fallbackOrder = [
        providerId,
        ...(config.fallbackOrder?.filter((p: string) => p !== providerId) || []),
      ];
      console.log(`Set '${providerId}' as primary provider.`);
      break;
    }
    case 'add': {
      const providerId = argv.id;
      if (!providerId) {
        throw new Error('Provider ID is required to add a new provider.');
      }

      const existingProvider = config.providers.find(
        (p: ProviderConfig) => p.id === providerId,
      );
      if (existingProvider) {
        throw new Error(
          `Provider '${providerId}' already exists. Use 'keys add' to add more API keys.`,
        );
      }

      const newProvider: ProviderConfig = {
        id: providerId,
        enabled: true,
        apiKeys: [],
      };

      if (argv.apiKey) {
        newProvider.apiKeys = [argv.apiKey];
      }

      config.providers.push(newProvider);
      console.log(`Added provider '${providerId}'.`);
      break;
    }
    case 'stats': {
      await handleStatsCommand(config, argv);
      break;
    }
    default:
      console.log(
        'Invalid provider command. Available commands: list, list-models, set, add, keys, stats',
      );
      return;
  }

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  if (
    argv.action === 'list' ||
    argv.action === 'set' ||
    argv.action === 'add'
  ) {
    console.log('Provider configuration updated.');
  }
}

async function handleStatsCommand(config: ProvidersConfig, argv: CliArgs) {
  const { getUsageStatsManager } = await import('@google/gemini-cli-core');
  const usageStats = getUsageStatsManager();

  const subcommand = argv.subcommand || argv._[1];

  switch (subcommand) {
    case 'summary': {
      const report = usageStats.generateSummaryReport();
      console.log('\n📊 Usage Statistics Summary:');
      console.log(`Total Sessions: ${report.totalSessions}`);
      console.log(`Total Commands: ${report.totalCommands}`);
      console.log(`Total Failures: ${report.totalFailures}`);

      if (report.averageSessionLength > 0) {
        const avgMinutes = Math.round(report.averageSessionLength / 60000);
        console.log(`Average Session Length: ${avgMinutes} minutes`);
      }

      if (report.topCommands.length > 0) {
        console.log('\n🔥 Most Used Commands:');
        report.topCommands.forEach((cmd, index) => {
          console.log(`  ${index + 1}. ${cmd.command} (${cmd.count} uses)`);
        });
      }

      if (report.providerReliability.length > 0) {
        console.log('\n⚡ Provider Reliability:');
        report.providerReliability.forEach((provider, index) => {
          const successRate = (provider.successRate * 100).toFixed(1);
          const indicator =
            provider.successRate > 0.9
              ? '🟢'
              : provider.successRate > 0.7
                ? '🟡'
                : '🔴';
          console.log(
            `  ${index + 1}. ${provider.provider} ${indicator} ${successRate}% (${provider.totalRequests} requests)`,
          );
        });
      }
      break;
    }
    case 'providers': {
      const providerStats = usageStats.getProviderStats();
      console.log('\n📡 Provider Usage Statistics:');

      if (Object.keys(providerStats).length === 0) {
        console.log('  No provider usage data available.');
        break;
      }

      Object.entries(providerStats).forEach(([providerId, stats]) => {
        const successRate =
          stats.totalRequests > 0
            ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(
                1,
              )
            : '0.0';
        const avgResponseTime =
          stats.averageResponseTime > 0
            ? `${Math.round(stats.averageResponseTime)}ms`
            : 'N/A';

        console.log(`\n🔧 ${providerId}:`);
        console.log(`  Total Requests: ${stats.totalRequests}`);
        console.log(`  Success Rate: ${successRate}%`);
        console.log(`  Average Response Time: ${avgResponseTime}`);
        console.log(`  Key Rotations: ${stats.keyRotationCount}`);
        console.log(`  Rate Limit Hits: ${stats.rateLimitHits}`);

        if (Object.keys(stats.failuresByReason).length > 0) {
          console.log('  Failure Breakdown:');
          Object.entries(stats.failuresByReason).forEach(([reason, count]) => {
            console.log(`    ${reason}: ${count}`);
          });
        }

        if (stats.lastUsed) {
          const lastUsed = new Date(stats.lastUsed).toLocaleString();
          console.log(`  Last Used: ${lastUsed}`);
        }
      });
      break;
    }
    case 'commands': {
      const commandStats = usageStats.getCommandStats();
      console.log('\n⌨️ Command Usage Statistics:');

      if (Object.keys(commandStats).length === 0) {
        console.log('  No command usage data available.');
        break;
      }

      const sortedCommands = Object.values(commandStats).sort(
        (a, b) => b.usageCount - a.usageCount,
      );

      sortedCommands.forEach((cmd, index) => {
        const successRate =
          cmd.usageCount > 0
            ? ((cmd.successCount / cmd.usageCount) * 100).toFixed(1)
            : '0.0';
        const avgTime =
          cmd.averageExecutionTime > 0
            ? `${Math.round(cmd.averageExecutionTime)}ms`
            : 'N/A';

        console.log(`\n${index + 1}. ${cmd.command}:`);
        console.log(`  Usage Count: ${cmd.usageCount}`);
        console.log(`  Success Rate: ${successRate}%`);
        console.log(`  Average Execution Time: ${avgTime}`);

        if (cmd.lastUsed) {
          const lastUsed = new Date(cmd.lastUsed).toLocaleString();
          console.log(`  Last Used: ${lastUsed}`);
        }
      });
      break;
    }
    case 'sessions': {
      const recentSessions = usageStats.getRecentSessions(10);
      console.log('\n🕐 Recent Sessions:');

      if (recentSessions.length === 0) {
        console.log('  No session data available.');
        break;
      }

      recentSessions.reverse().forEach((session, index) => {
        const startTime = new Date(session.startTime).toLocaleString();
        const duration = session.endTime
          ? `${Math.round((session.endTime - session.startTime) / 60000)} minutes`
          : 'Ongoing';

        console.log(`\n${index + 1}. Session ${session.sessionId}:`);
        console.log(`  Started: ${startTime}`);
        console.log(`  Duration: ${duration}`);
        console.log(`  Commands Executed: ${session.commandsExecuted}`);
        console.log(`  Tool Calls: ${session.toolCallsExecuted}`);
        console.log(`  Tokens Used: ${session.totalTokensUsed}`);
        console.log(
          `  Providers Used: ${session.providersUsed.join(', ') || 'None'}`,
        );
      });
      break;
    }
    case 'export': {
      if (!argv.export) {
        console.error('Export file path is required. Use --export <path>');
        break;
      }

      try {
        await usageStats.exportStats(argv.export);
        console.log(`✅ Usage statistics exported to: ${argv.export}`);
      } catch (error) {
        console.error('❌ Failed to export statistics:', error);
      }
      break;
    }
    case 'clear': {
      if (!argv.clear) {
        console.log('Use --clear to confirm clearing all usage statistics.');
        break;
      }

      try {
        await usageStats.clearStats();
        console.log('✅ All usage statistics have been cleared.');
      } catch (error) {
        console.error('❌ Failed to clear statistics:', error);
      }
      break;
    }
    default:
      console.log(
        'Invalid stats command. Available commands: summary, providers, commands, sessions, export, clear',
      );
      break;
  }
}

function getNodeMemoryArgs(config: Config): string[] {
  const totalMemoryMB = os.totalmem() / (1024 * 1024);
  const heapStats = v8.getHeapStatistics();
  const currentMaxOldSpaceSizeMb = Math.floor(
    heapStats.heap_size_limit / 1024 / 1024,
  );

  const targetMaxOldSpaceSizeInMB = Math.floor(totalMemoryMB * 0.5);
  if (config.getDebugMode()) {
    console.debug(
      `Current heap size ${currentMaxOldSpaceSizeMb.toFixed(2)} MB`,
    );
  }

  if (process.env.GEMINI_CLI_NO_RELAUNCH) {
    return [];
  }

  if (targetMaxOldSpaceSizeInMB > currentMaxOldSpaceSizeMb) {
    if (config.getDebugMode()) {
      console.debug(
        `Need to relaunch with more memory: ${targetMaxOldSpaceSizeInMB.toFixed(2)} MB`,
      );
    }
    return [`--max-old-space-size=${targetMaxOldSpaceSizeInMB}`];
  }

  return [];
}

async function relaunchWithAdditionalArgs(additionalArgs: string[]) {
  const nodeArgs = [...additionalArgs, ...process.argv.slice(1)];
  const newEnv = { ...process.env, GEMINI_CLI_NO_RELAUNCH: 'true' };

  const child = spawn(process.execPath, nodeArgs, {
    stdio: 'inherit',
    env: newEnv,
  });

  await new Promise((resolve) => child.on('close', resolve));
  process.exit(0);
}
import { runAcpPeer } from './acp/acpPeer.js';

export function setupUnhandledRejectionHandler() {
  let unhandledRejectionOccurred = false;
  process.on('unhandledRejection', (reason, _promise) => {
    const errorMessage = `=========================================
This is an unexpected error. Please file a bug report using the /bug tool.
CRITICAL: Unhandled Promise Rejection!
=========================================
Reason: ${reason}${
      reason instanceof Error && reason.stack
        ? `
Stack trace:
${reason.stack}`
        : ''
    }`;
    appEvents.emit(AppEvent.LogError, errorMessage);
    if (!unhandledRejectionOccurred) {
      unhandledRejectionOccurred = true;
      appEvents.emit(AppEvent.OpenDebugConsole);
    }
  });
}

function generateSessionId(): string {
  return `cli-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export async function main() {
  setupUnhandledRejectionHandler();
  const workspaceRoot = process.cwd();
  const settings = loadSettings(workspaceRoot);

  try {
    const { initializeUsageStats, getUsageStatsManager } = await import(
      '@google/gemini-cli-core'
    );
    await initializeUsageStats({
      enabled: true,
      anonymizationEnabled: true,
    });

    const sessionId = generateSessionId();
    const usageStats = getUsageStatsManager();
    await usageStats.startSession(sessionId);

    const cleanup = async () => {
      await usageStats.endSession();
    };
    process.on('exit', cleanup);
    process.on('SIGINT', async () => {
      await cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await cleanup();
      process.exit(0);
    });
  } catch (error) {
    console.warn('Failed to initialize usage statistics:', error);
  }

  await cleanupCheckpoints();
  if (settings.errors.length > 0) {
    for (const error of settings.errors) {
      let errorMessage = `Error in ${error.path}: ${error.message}`;
      if (!process.env.NO_COLOR) {
        errorMessage = `\x1b[31m${errorMessage}\x1b[0m`;
      }
      console.error(errorMessage);
      console.error(`Please fix ${error.path} and try again.`);
    }
    process.exit(1);
  }

  const argv = await parseArguments();
  if (argv._[0] === 'edit') {
    // Track edit command usage
    const startTime = Date.now();
    try {
      const { handleEditCommand } = await import('./commands/editCommand.js');
      const { getUsageStatsManager } = await import('@google/gemini-cli-core');
      const usageStats = getUsageStatsManager();
      const commandName = `edit ${argv.type}`;

      await handleEditCommand({
        type: argv.type!,
        name: argv.name!,
        editor: argv.editor,
        interactive: argv.interactive,
        field: argv.field,
        value: argv.value,
        validate: argv.validate,
      });

      const executionTime = Date.now() - startTime;
      await usageStats.recordCommand(commandName, executionTime, true);
    } catch (error) {
      try {
        const { getUsageStatsManager } = await import(
          '@google/gemini-cli-core'
        );
        const usageStats = getUsageStatsManager();
        const commandName = `edit ${argv.type}`;
        const executionTime = Date.now() - startTime;
        await usageStats.recordCommand(commandName, executionTime, false);
      } catch {
        // Ignore stats errors
      }
      throw error;
    }
    process.exit(0);
  }
  if (argv._[0] === 'generate') {
    const startTime = Date.now();
    try {
      const { handleGenerateCommand } = await import(
        './commands/generateCommand.js'
      );
      const { getUsageStatsManager } = await import('@google/gemini-cli-core');
      const usageStats = getUsageStatsManager();
      const commandName = `generate ${argv.type || ''}`;

      await handleGenerateCommand({
        type: argv.type!,
        name: argv.name,
        template: argv.template,
        interactive: argv.interactive,
        list: argv.list,
        search: argv.search,
        output: argv.output,
        dryRun: argv.dryRun,
        overwrite: argv.overwrite,
      });

      const executionTime = Date.now() - startTime;
      await usageStats.recordCommand(commandName, executionTime, true);
    } catch (error) {
      try {
        const { getUsageStatsManager } = await import(
          '@google/gemini-cli-core'
        );
        const usageStats = getUsageStatsManager();
        const commandName = `generate ${argv.type || ''}`;
        const executionTime = Date.now() - startTime;
        await usageStats.recordCommand(commandName, executionTime, false);
      } catch {
        // Ignore stats errors
      }
      throw error;
    }
    process.exit(0);
  }
  if (argv._[0] === 'provider') {
    const startTime = Date.now();
    try {
      const { getUsageStatsManager } = await import('@google/gemini-cli-core');
      const usageStats = getUsageStatsManager();
      const commandName = `provider ${argv.action || ''}`;

      await handleProviderCommand(argv);

      const executionTime = Date.now() - startTime;
      await usageStats.recordCommand(commandName, executionTime, true);
    } catch (error) {
      try {
        const { getUsageStatsManager } = await import(
          '@google/gemini-cli-core'
        );
        const usageStats = getUsageStatsManager();
        const commandName = `provider ${argv.action || ''}`;
        const executionTime = Date.now() - startTime;
        await usageStats.recordCommand(commandName, executionTime, false);
      } catch {
        // Ignore stats errors
      }
      throw error;
    }
    process.exit(0);
  }
  const extensions = loadExtensions(workspaceRoot);
  const config = await loadCliConfig(
    settings.merged,
    extensions,
    sessionId,
    argv,
  );

  if (argv.promptInteractive && !process.stdin.isTTY) {
    console.error(
      'Error: The --prompt-interactive flag is not supported when piping input from stdin.',
    );
    process.exit(1);
  }

  if (config.getListExtensions()) {
    console.log('Installed extensions:');
    for (const extension of extensions) {
      console.log(`- ${extension.config.name}`);
    }
    process.exit(0);
  }

  if (!settings.merged.selectedAuthType) {
    if (process.env.CLOUD_SHELL === 'true') {
      settings.setValue(
        SettingScope.User,
        'selectedAuthType',
        AuthType.CLOUD_SHELL,
      );
    }
  }

  setMaxSizedBoxDebugging(config.getDebugMode());

  await config.initialize();

  themeManager.loadCustomThemes(settings.merged.customThemes);

  if (settings.merged.theme) {
    if (!themeManager.setActiveTheme(settings.merged.theme)) {
      console.warn(`Warning: Theme "${settings.merged.theme}" not found.`);
    }
  }

  if (!process.env.SANDBOX) {
    const memoryArgs = settings.merged.autoConfigureMaxOldSpaceSize
      ? getNodeMemoryArgs(config)
      : [];
    const sandboxConfig = config.getSandbox();
    if (sandboxConfig) {
      if (settings.merged.selectedAuthType) {
        try {
          const err = validateAuthMethod(settings.merged.selectedAuthType);
          if (err) {
            throw new Error(err);
          }
          await config.refreshAuth(settings.merged.selectedAuthType);
        } catch (err) {
          console.error('Error authenticating:', err);
          process.exit(1);
        }
      }
      await start_sandbox(sandboxConfig, memoryArgs, config);
      process.exit(0);
    } else {
      if (memoryArgs.length > 0) {
        await relaunchWithAdditionalArgs(memoryArgs);
        process.exit(0);
      }
    }
  }

  if (
    settings.merged.selectedAuthType === AuthType.LOGIN_WITH_GOOGLE &&
    config.isBrowserLaunchSuppressed()
  ) {
    await getOauthClient(settings.merged.selectedAuthType, config);
  }

  if (config.getExperimentalAcp()) {
    return runAcpPeer(config, settings);
  }

  let input = config.getQuestion();
  const startupWarnings = [
    ...(await getStartupWarnings()),
    ...(await getUserStartupWarnings(workspaceRoot)),
  ];

  const shouldBeInteractive =
    !!argv.promptInteractive || (process.stdin.isTTY && input?.length === 0);

  if (shouldBeInteractive) {
    const version = await getCliVersion();
    setWindowTitle(basename(workspaceRoot), settings);
    const instance = render(
      <React.StrictMode>
        <AppWrapper
          config={config}
          settings={settings}
          startupWarnings={startupWarnings}
          version={version}
        />
      </React.StrictMode>,
      { exitOnCtrlC: false },
    );

    checkForUpdates()
      .then((info) => {
        if (info) {
          handleAutoUpdate(info, settings, config.getProjectRoot());
        }
      })
      .catch((err) => {
        if (config.getDebugMode()) {
          console.error('Update check failed:', err);
        }
      });

    registerCleanup(() => instance.unmount());
    return;
  }
  if (!process.stdin.isTTY && !input) {
    input += await readStdin();
  }
  if (!input) {
    console.error('No input provided via stdin.');
    process.exit(1);
  }

  const prompt_id = Math.random().toString(16).slice(2);
  logUserPrompt(config, {
    'event.name': 'user_prompt',
    'event.timestamp': new Date().toISOString(),
    prompt: input,
    prompt_id,
    auth_type: config.getContentGeneratorConfig()?.authType,
    prompt_length: input.length,
  });

  const nonInteractiveConfig = await loadNonInteractiveConfig(
    config,
    extensions,
    settings,
    argv,
  );

  await runNonInteractive(nonInteractiveConfig, input, prompt_id);
  process.exit(0);
}

function setWindowTitle(title: string, settings: LoadedSettings) {
  if (!settings.merged.hideWindowTitle) {
    const windowTitle = (process.env.CLI_TITLE || `Gemini - ${title}`).replace(
      // eslint-disable-next-line no-control-regex
      /[\x00-\x1F\x7F]/g,
      '',
    );
    process.stdout.write(`\x1b]2;${windowTitle}\x07`);

    process.on('exit', () => {
      process.stdout.write(`\x1b]2;\x07`);
    });
  }
}

async function loadNonInteractiveConfig(
  config: Config,
  extensions: Extension[],
  settings: LoadedSettings,
  argv: CliArgs,
) {
  let finalConfig = config;
  if (config.getApprovalMode() !== ApprovalMode.YOLO) {
    const existingExcludeTools = settings.merged.excludeTools || [];
    const interactiveTools = [
      ShellTool.Name,
      EditTool.Name,
      WriteFileTool.Name,
    ];

    const newExcludeTools = [
      ...new Set([...existingExcludeTools, ...interactiveTools]),
    ];

    const nonInteractiveSettings = {
      ...settings.merged,
      excludeTools: newExcludeTools,
    };
    finalConfig = await loadCliConfig(
      nonInteractiveSettings,
      extensions,
      config.getSessionId(),
      argv,
    );
    await finalConfig.initialize();
  }

  return await validateNonInteractiveAuth(
    settings.merged.selectedAuthType,
    finalConfig,
  );
}
