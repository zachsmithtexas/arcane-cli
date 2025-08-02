# Arcane CLI – Project Task Breakdown

## 0. Branding & UI

- [x] **Arcane-Branded Home UI with Custom ASCII Art:**  
       Replace the default home/landing page branding (previously >GEMINI) with Arcane’s own branding and the following ASCII art, formatted as shown below.  
       _Criteria:_ ASCII art appears exactly as below, with theming/color palette to match Arcane’s brand.  
       _File:_ `/core/ui.js` (or main CLI entry)

      ```
      ⠀⠀⠀⠀⠀⡰⠀⠀⠀⠀⠀⠀⠀
      ⠀⠀⠀⠀⠀⠘⣶⣄⠀⠀⠀⠀⠀
      ⠀⠠⢴⡦⠄⢠⣿⣟⡂⠀⠀⠀⠀
      ⠀⠀⠈⠉⢀⣾⣿⣿⣷⠀⠀⠀⠀
      ⠀⠀⠀⣠⡼⣯⣽⣿⣿⣵⢄⠀⠀
      ⠀⠀⠀⠀⠀⢻⠛⠛⠏⠀⢁⣠⣀
      ⠀⠀⠀⢰⣿⡀⠀⠀⠈⣿⡔⠚⠀
      ⣠⡀⠀⣿⣿⢀⡀⠀⣿⣿⣷⠀⠀
      ⠈⠀⢸⣿⣿⣿⡄⢠⣿⣿⣿⡆⠀
      ⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⠀
      ⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆
      ⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
      ```

---

## 1. Provider Modularity & API Management

- [x] **Implement Provider Plugin Loader (`/core/providers/`):**  
       Create a modular loader for AI provider plugins (OpenRouter, Groq, Gemini, etc.) based on config files.  
       _Criteria:_ Supports hot-swapping, dynamic loading, and fallback logic.  
       _File:_ `/core/providers/loader.js`

- [x] **Add Provider Adapter Pattern:**  
       Refactor the API interaction layer to use an adapter interface for each provider.  
       _Criteria:_ Easy to add new providers, standardized interface, with tests.  
       _File:_ `/core/providers/adapters/`

- [x] **Hot-Swap & Add Providers via CLI:**  
       Add CLI flags/commands to swap or add providers at runtime without restarts.  
       _Criteria:_ Can switch active provider or add new ones via CLI/config, with instant effect.  
       _File:_ `cli/provider.js`

- [x] **API Key Rotation & Provider Fallback:**  
       Implement key rotation/fallback logic for rate-limited or failing providers.  
       _Criteria:_ Automatic key fallback, CLI flag to view/set active key, logs failures.  
       _File:_ `/core/providers/keys.js`

- [x] **Track Usage Stats & Provider Failures:**  
       Build anonymized tracking of command frequency and provider success/failures (toggleable).  
       _Criteria:_ Stats logged locally, opt-out available.  
       _File:_ `/core/telemetry.js`

## 2. Agent, Role & Skill System

- [x] **Scripted Agent/Role/Skill Generation (`cli/generate.js`):**  
       Create scripts to generate and assign new agents, roles, and skills from CLI with guided prompts.  
       _Criteria:_ CLI command scaffolds markdown files, supports fuzzy search, writes to `.arcane/` structure.  
       _File:_ `cli/generate.js`

- [x] **Agent Metadata as Markdown (`agents/[name]/meta.md`):**  
       Store/edit agent, role, and skill metadata in markdown (frontmatter).  
       _Criteria:_ Agents reference meta.md, editable via CLI or text editor.  
       _File:_ `.arcane/agents/`

- [ ] **Dynamic Capability/Restriction by Role/Skill:**  
       Enforce dynamic agent capabilities/restrictions based on assigned roles/skills.  
       _Criteria:_ Agent actions limited by metadata, updated live.  
       _Depends on:_ Agent metadata task.

- [ ] **Skill & Role Hot-Swapping:**  
       Implement CLI/UI for live updating agent skills/roles.  
       _Criteria:_ PMs can reassign/upgrade skills with instant effect.  
       _File:_ `cli/skills.js`

- [ ] **Automated Docs Generation:**  
       Script automated markdown docs for every new agent, skill, or CLI command.  
       _Criteria:_ Every generator produces up-to-date docs.  
       _File:_ `cli/generate.js` extension.

## 3. Plugin System & Extensibility

- [ ] **Plugin Marketplace Stub:**  
       Add a stub command for a future plugin marketplace, with placeholder discover/install logic.  
       _Criteria:_ `arcane plugin search` exists; logs "Coming Soon".  
       _File:_ `cli/plugin.js`

- [ ] **Enable Third-party Plugins/Extensions:**  
       Define and expose plugin API for community extensions (e.g. new AI models, file actions).  
       _Criteria:_ Plugins can be loaded dynamically, docs provided.  
       _Depends on:_ Provider plugin loader.

## 4. Project & Task Management

- [ ] **Kanban/Task File Generation:**  
       Automate Kanban/task file generation from CLI or scripts.  
       _Criteria:_ `arcane task create` produces markdown files, supports YAML frontmatter.  
       _File:_ `cli/task.js`

- [ ] **Automated Kanban Board Integration:**  
       Integrate with Obsidian, GitHub Projects, etc. for live sync.  
       _Criteria:_ Tasks auto-update external boards.  
       _Depends on:_ Kanban file generation.

- [ ] **Task Lifecycle Automation:**  
       Automate state transitions (backlog → in progress → review → done), with commands to claim/complete/reject tasks.  
       _Criteria:_ CLI commands for each state, agent can own/reject/escalate.  
       _File:_ `cli/task.js`

- [ ] **Auto-generate Changelogs & Commits:**  
       Generate changelogs and commit messages for every major change.  
       _Criteria:_ Command outputs changelog.md, prompts for commit messages.  
       _File:_ `cli/changelog.js`

## 5. Memory, Context & Persistence

- [ ] **Persistent `.memory.json` for Agent Context:**  
       Implement persistent storage of agent memory/history across CLI sessions.  
       _Criteria:_ Context saved and reloaded between runs.  
       _File:_ `.arcane/memory.json`

- [ ] **Modular Context Layers:**  
       Support global, per-project, and per-agent context layers for better memory management.  
       _Criteria:_ CLI flag selects context layer, logic merges context as needed.  
       _File:_ `/core/context.js`

- [ ] **True Persistence (Auto-Save & Reload):**  
       Auto-save chat/task state after every interaction and reload on launch.  
       _Criteria:_ State files written to disk, appended on reload, supports both JSON and markdown.  
       _Depends on:_ Persistent memory.

## 6. Sandboxing, Security, and Audit

- [ ] **Improved Sandboxing (Docker/virtualenv):**  
       Enhance Docker/virtualenv integration for per-task containerization.  
       _Criteria:_ Each task runs in isolated sandbox by default, configurable.  
       _File:_ `/core/sandbox.js`

- [ ] **Shell-Safe Plan Translation:**  
       Ensure all AI-generated shell commands are safely validated before execution.  
       _Criteria:_ Unsafe commands are flagged/blocked; review required for risky actions.  
       _File:_ `/core/shellsafe.js`

- [ ] **Security/Audit Mode:**  
       Add logging for shell commands, API calls, and context for audit/debug.  
       _Criteria:_ Toggleable via CLI, logs saved in `/logs/audit/`.  
       _File:_ `/core/audit.js`

## 7. User Experience & Theming

- [ ] **Theming and Color Schemes:**  
       Add Aura palette support and modern CLI visuals.  
       _Criteria:_ Color schemes switchable by CLI flag/config.  
       _File:_ `/core/theme.js`

- [ ] **Custom Progress Spinners and Splash Screens:**  
       Implement custom CLI spinners and stylized splash screens using `figlet`/`gradient-string`.  
       _Criteria:_ CLI output is stylish, splash appears on start.  
       _File:_ `/core/ui.js`

- [ ] **Fun/Friendly Error Messages:**  
       Refactor errors and guidance to be more friendly and actionable.  
       _Criteria:_ Common errors return help, links, or jokes.  
       _File:_ `/core/errors.js`

## 8. Productivity & Workflow Tools

- [ ] **Clipboard Watcher/Reminder:**  
       Add CLI tool for clipboard watching and reminders for capturing AI output.  
       _Criteria:_ Runs in background, notifies on empty clipboard, can auto-paste content.  
       _File:_ `/core/clipboard.js`

- [ ] **“Send to Obsidian” Command:**  
       Enable sending code/docs/output directly to Obsidian from CLI.  
       _Criteria:_ Output appears in configured Obsidian vault.  
       _File:_ `cli/obsidian.js`

- [ ] **Built-in Backup/Export/Import:**  
       Script backup/export/import for config, agents, skills, and history.  
       _Criteria:_ CLI commands to backup, restore, and import/export core data.  
       _File:_ `/core/backup.js`

## 9. Advanced Agent Capabilities

- [ ] **Agent-based Code Review/Lint/Test:**  
       Add commands for agent-driven code review, linting, and test script running.  
       _Criteria:_ Code can be reviewed or tested by selected agent; suggestions logged.  
       _File:_ `/core/review.js`

- [ ] **AI-on-AI Regression Testing:**  
       Enable an agent to periodically retest fixed bugs/features and report status.  
       _Criteria:_ Regression suite scheduled or triggered by CLI.  
       _File:_ `/core/regression.js`

## 10. Miscellaneous/Low Priority

- [ ] **User Profiles/Config Presets:**  
       Support saving/loading user/dev profiles (e.g., API keys, settings).  
       _Criteria:_ CLI flag to select or create profiles; instant config swap.  
       _File:_ `/core/profiles.js`

- [ ] **Output CLI Telemetry for Debugging:**  
       Add option to output CLI telemetry for debugging performance.  
       _Criteria:_ Toggleable; logs to local file.  
       _File:_ `/core/telemetry.js`

- [ ] **Command-line “No-confirm” Mode:**  
       Add command-line argument to skip approval for shell commands.  
       _Criteria:_ `--no-confirm` bypasses approval prompts.  
       _File:_ `cli/flags.js`

- [ ] **Seamless Download/Extract for Zips/Agent Output:**  
       Support auto-download and extraction for research zips or agent files.  
       _Criteria:_ CLI command downloads and extracts, handles file collisions.  
       _File:_ `/core/download.js`
