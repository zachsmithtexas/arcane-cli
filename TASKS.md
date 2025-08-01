# Arcane CLI – Project Task Breakdown

## 1. Provider Modularity & API Management

- [x] **Implement Provider Plugin Loader (`/core/providers/`):**  
  Create a modular loader for AI provider plugins (OpenRouter, Groq, Gemini, etc.) based on config files.  
  *Criteria:* Supports hot-swapping, dynamic loading, and fallback logic.  
  *File:* `/core/providers/loader.js`

- [x] **Add Provider Adapter Pattern:**  
  Refactor the API interaction layer to use an adapter interface for each provider.  
  *Criteria:* Easy to add new providers, standardized interface, with tests.  
  *File:* `/core/providers/adapters/`

- [ ] **Hot-Swap & Add Providers via CLI:**  
  Add CLI flags/commands to swap or add providers at runtime without restarts.  
  *Criteria:* Can switch active provider or add new ones via CLI/config, with instant effect.  
  *File:* `cli/provider.js`

- [ ] **API Key Rotation & Provider Fallback:**  
  Implement key rotation/fallback logic for rate-limited or failing providers.  
  *Criteria:* Automatic key fallback, CLI flag to view/set active key, logs failures.  
  *File:* `/core/providers/keys.js`

- [ ] **Track Usage Stats & Provider Failures:**  
  Build anonymized tracking of command frequency and provider success/failures (toggleable).  
  *Criteria:* Stats logged locally, opt-out available.  
  *File:* `/core/telemetry.js`

## 2. Agent, Role & Skill System

- [ ] **Scripted Agent/Role/Skill Generation (`cli/generate.js`):**  
  Create scripts to generate and assign new agents, roles, and skills from CLI with guided prompts.  
  *Criteria:* CLI command scaffolds markdown files, supports fuzzy search, writes to `.arcane/` structure.  
  *File:* `cli/generate.js`

- [ ] **Agent Metadata as Markdown (`agents/[name]/meta.md`):**  
  Store/edit agent, role, and skill metadata in markdown (frontmatter).  
  *Criteria:* Agents reference meta.md, editable via CLI or text editor.  
  *File:* `.arcane/agents/`

- [ ] **Dynamic Capability/Restriction by Role/Skill:**  
  Enforce dynamic agent capabilities/restrictions based on assigned roles/skills.  
  *Criteria:* Agent actions limited by metadata, updated live.  
  *Depends on:* Agent metadata task.

- [ ] **Skill & Role Hot-Swapping:**  
  Implement CLI/UI for live updating agent skills/roles.  
  *Criteria:* PMs can reassign/upgrade skills with instant effect.  
  *File:* `cli/skills.js`

- [ ] **Automated Docs Generation:**  
  Script automated markdown docs for every new agent, skill, or CLI command.  
  *Criteria:* Every generator produces up-to-date docs.  
  *File:* `cli/generate.js` extension.

## 3. Plugin System & Extensibility

- [ ] **Plugin Marketplace Stub:**  
  Add a stub command for a future plugin marketplace, with placeholder discover/install logic.  
  *Criteria:* `arcane plugin search` exists; logs "Coming Soon".  
  *File:* `cli/plugin.js`

- [ ] **Enable Third-party Plugins/Extensions:**  
  Define and expose plugin API for community extensions (e.g. new AI models, file actions).  
  *Criteria:* Plugins can be loaded dynamically, docs provided.  
  *Depends on:* Provider plugin loader.

## 4. Project & Task Management

- [ ] **Kanban/Task File Generation:**  
  Automate Kanban/task file generation from CLI or scripts.  
  *Criteria:* `arcane task create` produces markdown files, supports YAML frontmatter.  
  *File:* `cli/task.js`

- [ ] **Automated Kanban Board Integration:**  
  Integrate with Obsidian, GitHub Projects, etc. for live sync.  
  *Criteria:* Tasks auto-update external boards.  
  *Depends on:* Kanban file generation.

- [ ] **Task Lifecycle Automation:**  
  Automate state transitions (backlog → in progress → review → done), with commands to claim/complete/reject tasks.  
  *Criteria:* CLI commands for each state, agent can own/reject/escalate.  
  *File:* `cli/task.js`

- [ ] **Auto-generate Changelogs & Commits:**  
  Generate changelogs and commit messages for every major change.  
  *Criteria:* Command outputs changelog.md, prompts for commit messages.  
  *File:* `cli/changelog.js`

## 5. Memory, Context & Persistence

- [ ] **Persistent `.memory.json` for Agent Context:**  
  Implement persistent storage of agent memory/history across CLI sessions.  
  *Criteria:* Context saved and reloaded between runs.  
  *File:* `.arcane/memory.json`

- [ ] **Modular Context Layers:**  
  Support global, per-project, and per-agent context layers for better memory management.  
  *Criteria:* CLI flag selects context layer, logic merges context as needed.  
  *File:* `/core/context.js`

- [ ] **True Persistence (Auto-Save & Reload):**  
  Auto-save chat/task state after every interaction and reload on launch.  
  *Criteria:* State files written to disk, appended on reload, supports both JSON and markdown.  
  *Depends on:* Persistent memory.

## 6. Sandboxing, Security, and Audit

- [ ] **Improved Sandboxing (Docker/virtualenv):**  
  Enhance Docker/virtualenv integration for per-task containerization.  
  *Criteria:* Each task runs in isolated sandbox by default, configurable.  
  *File:* `/core/sandbox.js`

- [ ] **Shell-Safe Plan Translation:**  
  Ensure all AI-generated shell commands are safely validated before execution.  
  *Criteria:* Unsafe commands are flagged/blocked; review required for risky actions.  
  *File:* `/core/shellsafe.js`

- [ ] **Security/Audit Mode:**  
  Add logging for shell commands, API calls, and context for audit/debug.  
  *Criteria:* Toggleable via CLI, logs saved in `/logs/audit/`.  
  *File:* `/core/audit.js`

## 7. User Experience & Theming

- [ ] **Theming and Color Schemes:**  
  Add Aura palette support and modern CLI visuals.  
  *Criteria:* Color schemes switchable by CLI flag/config.  
  *File:* `/core/theme.js`

- [ ] **Custom Progress Spinners and Splash Screens:**  
  Implement custom CLI spinners and stylized splash screens using `figlet`/`gradient-string`.  
  *Criteria:* CLI output is stylish, splash appears on start.  
  *File:* `/core/ui.js`

- [ ] **Fun/Friendly Error Messages:**  
  Refactor errors and guidance to be more friendly and actionable.  
  *Criteria:* Common errors return help, links, or jokes.  
  *File:* `/core/errors.js`

## 8. Productivity & Workflow Tools

- [ ] **Clipboard Watcher/Reminder:**  
  Add CLI tool for clipboard watching and reminders for capturing AI output.  
  *Criteria:* Runs in background, notifies on empty clipboard, can auto-paste content.  
  *File:* `/core/clipboard.js`

- [ ] **“Send to Obsidian” Command:**  
  Enable sending code/docs/output directly to Obsidian from CLI.  
  *Criteria:* Output appears in configured Obsidian vault.  
  *File:* `cli/obsidian.js`

- [ ] **Built-in Backup/Export/Import:**  
  Script backup/export/import for config, agents, skills, and history.  
  *Criteria:* CLI commands to backup, restore, and import/export core data.  
  *File:* `/core/backup.js`

## 9. Advanced Agent Capabilities

- [ ] **Agent-based Code Review/Lint/Test:**  
  Add commands for agent-driven code review, linting, and test script running.  
  *Criteria:* Code can be reviewed or tested by selected agent; suggestions logged.  
  *File:* `/core/review.js`

- [ ] **AI-on-AI Regression Testing:**  
  Enable an agent to periodically retest fixed bugs/features and report status.  
  *Criteria:* Regression suite scheduled or triggered by CLI.  
  *File:* `/core/regression.js`

## 10. Miscellaneous/Low Priority

- [ ] **User Profiles/Config Presets:**  
  Support saving/loading user/dev profiles (e.g., API keys, settings).  
  *Criteria:* CLI flag to select or create profiles; instant config swap.  
  *File:* `/core/profiles.js`

- [ ] **Output CLI Telemetry for Debugging:**  
  Add option to output CLI telemetry for debugging performance.  
  *Criteria:* Toggleable; logs to local file.  
  *File:* `/core/telemetry.js`

- [ ] **Command-line “No-confirm” Mode:**  
  Add command-line argument to skip approval for shell commands.  
  *Criteria:* `--no-confirm` bypasses approval prompts.  
  *File:* `cli/flags.js`

- [ ] **Seamless Download/Extract for Zips/Agent Output:**  
  Support auto-download and extraction for research zips or agent files.  
  *Criteria:* CLI command downloads and extracts, handles file collisions.  
  *File:* `/core/download.js`

> Copy/paste this into your Obsidian vault or GitHub Project for atomic task management.
