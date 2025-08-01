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
  let config;
  try {
    const file = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(file);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      config = { providers: [], fallbackOrder: [] };
    } else {
      throw error;
    }
  }

  switch (argv.action) {
    case 'list':
      console.log('Available providers:');
      config.providers.forEach((provider: any, index: number) => {
        const keyCount = provider.apiKeys ? provider.apiKeys.length : (provider.apiKey ? 1 : 0);
        const status = provider.enabled ? '✅ enabled' : '❌ disabled';
        console.log(`  ${index + 1}. ${provider.id} (${keyCount} keys) - ${status}`);
      });
      if (config.fallbackOrder && config.fallbackOrder.length > 0) {
        console.log('Fallback order:', config.fallbackOrder.join(' → '));
      }
      break;

    case 'set':
      if (!argv.id) {
        throw new Error('Provider ID is required to set the active provider.');
      }
      config.fallbackOrder = [
        argv.id,
        ...config.fallbackOrder.filter((p: string) => p !== argv.id),
      ];
      console.log(`Set '${argv.id}' as primary provider.`);
      break;

    case 'add':
      if (!argv.id) {
        throw new Error('Provider ID is required to add a new provider.');
      }
      
      // Check if provider already exists
      const existingProvider = config.providers.find((p: any) => p.id === argv.id);
      if (existingProvider) {
        throw new Error(`Provider '${argv.id}' already exists. Use 'keys add' to add more API keys.`);
      }

      const newProvider: any = {
        id: argv.id,
        enabled: true,
      };

      // Support both legacy single key and new multi-key format
      if (argv.apiKey) {
        newProvider.apiKeys = [argv.apiKey];
      } else {
        newProvider.apiKeys = [];
      }

      config.providers.push(newProvider);
      console.log(`Added provider '${argv.id}'.`);
      break;

    case 'keys':
      await handleKeyCommand(config, argv);
      break;

    default:
      console.log(
        'Invalid provider command. Available commands: list, set, add, keys',
      );
      return; // Don't save config for invalid commands
  }

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  if (argv.action !== 'keys') {
    console.log('Provider configuration updated.');
  }
  // TODO: Reload ProviderManager
}

async function handleKeyCommand(config: any, argv: CliArgs) {
  const subcommand = argv.subcommand || argv._[1]; // Handle both direct and nested commands
  
  switch (subcommand) {
    case 'list':
      console.log('API Keys by Provider:');
      config.providers.forEach((provider: any) => {
        console.log(`\n📡 ${provider.id}:`);
        const keys = provider.apiKeys || (provider.apiKey ? [provider.apiKey] : []);
        if (keys.length === 0) {
          console.log('  No API keys configured');
        } else {
          keys.forEach((key: any, index: number) => {
            const keyStr = typeof key === 'string' ? key : key.key;
            const masked = keyStr.substring(0, 8) + '...' + keyStr.substring(keyStr.length - 4);
            const status = typeof key === 'object' && key.status ? key.status : 'active';
            const indicator = status === 'active' ? '🟢' : status === 'rate_limited' ? '🟡' : '🔴';
            console.log(`    ${index + 1}. ${masked} ${indicator} ${status}`);
          });
        }
      });
      break;

    case 'add':
      if (!argv.id && !argv.provider) {
        throw new Error('Provider ID is required (use --id or --provider).');
      }
      if (!argv.apiKey && !argv.key) {
        throw new Error('API key is required (use --api-key or --key).');
      }

      const providerId = argv.id || argv.provider;
      const newKey = argv.apiKey || argv.key;
      const provider = config.providers.find((p: any) => p.id === providerId);
      
      if (!provider) {
        throw new Error(`Provider '${providerId}' not found. Use 'provider add' first.`);
      }

      // Initialize apiKeys if not present
      if (!provider.apiKeys) {
        provider.apiKeys = provider.apiKey ? [provider.apiKey] : [];
        delete provider.apiKey; // Remove legacy single key
      }

      // Check for duplicate keys
      const existingKeys = provider.apiKeys.map((k: any) => typeof k === 'string' ? k : k.key);
      if (existingKeys.includes(newKey)) {
        throw new Error('This API key already exists for this provider.');
      }

      provider.apiKeys.push(newKey);
      console.log(`Added API key to provider '${providerId}' (${provider.apiKeys.length} total keys).`);
      break;

    case 'set':
      if (!argv.id && !argv.provider) {
        throw new Error('Provider ID is required (use --id or --provider).');
      }
      if (!argv.apiKey && !argv.key) {
        throw new Error('API key is required (use --api-key or --key).');
      }

      const setProviderId = argv.id || argv.provider;
      const activeKey = argv.apiKey || argv.key;
      const setProvider = config.providers.find((p: any) => p.id === setProviderId);
      
      if (!setProvider) {
        throw new Error(`Provider '${setProviderId}' not found.`);
      }

      // Find the key and move it to the front (making it primary)
      const keys = setProvider.apiKeys || [];
      const keyIndex = keys.findIndex((k: any) => {
        const keyStr = typeof k === 'string' ? k : k.key;
        return keyStr === activeKey;
      });

      if (keyIndex === -1) {
        throw new Error('Specified API key not found for this provider.');
      }

      // Move the key to the front
      const [selectedKey] = keys.splice(keyIndex, 1);
      keys.unshift(selectedKey);
      setProvider.apiKeys = keys;

      console.log(`Set API key as primary for provider '${setProviderId}'.`);
      break;

    case 'status':
    case 'stats':
      console.log('🔍 Provider Key Statistics:');
      config.providers.forEach((provider: any) => {
        const keys = provider.apiKeys || (provider.apiKey ? [provider.apiKey] : []);
        console.log(`\n📡 ${provider.id}:`);
        console.log(`  Total keys: ${keys.length}`);
        
        if (keys.length > 0) {
          let activeCount = 0;
          let rateLimitedCount = 0;
          let failedCount = 0;
          
          keys.forEach((key: any) => {
            if (typeof key === 'object' && key.status) {
              switch (key.status) {
                case 'active': activeCount++; break;
                case 'rate_limited': rateLimitedCount++; break;
                case 'failed': failedCount++; break;
              }
            } else {
              activeCount++; // Assume string keys are active
            }
          });

          console.log(`  Active: ${activeCount} 🟢`);
          if (rateLimitedCount > 0) console.log(`  Rate Limited: ${rateLimitedCount} 🟡`);
          if (failedCount > 0) console.log(`  Failed: ${failedCount} 🔴`);
        } else {
          console.log('  No keys configured ⚠️');
        }
      });
      break;

    default:
      console.log(
        'Invalid key command. Available commands: list, add, set, status, stats',
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

  // Set target to 50% of total memory
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

export async function main() {
  setupUnhandledRejectionHandler();
  const workspaceRoot = process.cwd();
  const settings = loadSettings(workspaceRoot);

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
  if (argv._[0] === 'provider') {
    await handleProviderCommand(argv);
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

  // Set a default auth type if one isn't set.
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

  // Load custom themes from settings
  themeManager.loadCustomThemes(settings.merged.customThemes);

  if (settings.merged.theme) {
    if (!themeManager.setActiveTheme(settings.merged.theme)) {
      // If the theme is not found during initial load, log a warning and continue.
      // The useThemeCommand hook in App.tsx will handle opening the dialog.
      console.warn(`Warning: Theme "${settings.merged.theme}" not found.`);
    }
  }

  // hop into sandbox if we are outside and sandboxing is enabled
  if (!process.env.SANDBOX) {
    const memoryArgs = settings.merged.autoConfigureMaxOldSpaceSize
      ? getNodeMemoryArgs(config)
      : [];
    const sandboxConfig = config.getSandbox();
    if (sandboxConfig) {
      if (settings.merged.selectedAuthType) {
        // Validate authentication here because the sandbox will interfere with the Oauth2 web redirect.
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
      // Not in a sandbox and not entering one, so relaunch with additional
      // arguments to control memory usage if needed.
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
    // Do oauth before app renders to make copying the link possible.
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

  // Render UI, passing necessary config values. Check that there is no command line question.
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
        handleAutoUpdate(info, settings, config.getProjectRoot());
      })
      .catch((err) => {
        // Silently ignore update check errors.
        if (config.getDebugMode()) {
          console.error('Update check failed:', err);
        }
      });

    registerCleanup(() => instance.unmount());
    return;
  }
  // If not a TTY, read from stdin
  // This is for cases where the user pipes input directly into the command
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

  // Non-interactive mode handled by runNonInteractive
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
    // Everything is not allowed, ensure that only read-only tools are configured.
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
