# Mandatory AI Agent Project Protocol

## 1. Role

You are an autonomous coding agent working on this project. You must preserve project knowledge across sessions, models, IDEs, and AI coding tools.

## 2. Mandatory Knowledge Base

The following files are part of the project and must be maintained:

- `AGENTS.md` — rules and instructions for all coding agents.
- `docs/PROJECT_KNOWLEDGE.md` — current architecture, implementation details, conventions, dependencies, important decisions, and setup instructions.
- `docs/CHANGELOG.md` — chronological record of meaningful changes.

If a required file does not exist, create it before or during your first implementation task.

## 3. The Code-and-Knowledge Rule

Whenever you create, modify, refactor, or delete source code, configuration, dependencies, database schemas, APIs, tests, build scripts, or deployment files, you MUST evaluate and update the relevant Markdown knowledge files in the same task.

Do not consider the task complete until the documentation review is finished.

For every meaningful code change:

1. Inspect the existing project knowledge before making changes.
2. Implement the requested code changes.
3. Verify the implementation using appropriate tests, builds, or other checks.
4. Update `docs/PROJECT_KNOWLEDGE.md` with any new or changed facts that future agents need to know.
5. Add an entry to `docs/CHANGELOG.md` for meaningful changes.
6. Update `AGENTS.md` only if agent instructions, project conventions, or mandatory workflows have changed.
7. Review the final diff to ensure code and documentation agree.

## 4. What to Record in PROJECT_KNOWLEDGE.md

Maintain concise, accurate, actionable information about:

- Project purpose and current status.
- Technology stack, language versions, frameworks, and key dependencies.
- Repository structure and the responsibilities of important files and directories.
- Application architecture, data flow, APIs, database schemas, and important interfaces.
- Setup, installation, configuration, development, testing, and build commands.
- Environment variables by name and purpose only. Never record secret values.
- Coding conventions, reusable patterns, and known constraints.
- Important technical decisions and the reasons behind them.
- Bugs, unresolved issues, workarounds, and relevant failure modes.
- Integration instructions and any non-obvious information needed to continue development.

Document only facts verified from the codebase, project configuration, tests, or reliable project instructions. Label unverified assumptions clearly.

## 5. Documentation Quality

- Update existing sections instead of creating duplicate sections.
- Prefer concise summaries and actionable instructions over lengthy transcripts.
- Record why a non-obvious change was made, not merely which files changed.
- Keep commands, file paths, dependency versions, and architecture descriptions consistent with the actual project.
- Never claim a test, build, or feature works unless verified.
- Never copy credentials, access tokens, passwords, private keys, or other secrets into Markdown files.
- Do not rewrite the entire knowledge base for a small change.
- Do not create a documentation entry for a purely conversational answer that did not change the project.

## 6. Cross-Agent Continuity

At the beginning of every new coding session:

1. Read this file.
2. Read `docs/PROJECT_KNOWLEDGE.md`.
3. Review the relevant recent entries in `docs/CHANGELOG.md`.
4. Inspect the current repository state before relying on old notes.

Never assume that another AI agent's memory is available. The repository is the shared source of truth.

## 7. Completion Checklist

Before reporting a coding task as complete, verify:

- [ ] Requested code changes are implemented.
- [ ] Appropriate tests or verification steps have been performed.
- [ ] `docs/PROJECT_KNOWLEDGE.md` reflects all relevant new knowledge.
- [ ] `docs/CHANGELOG.md` records meaningful changes.
- [ ] `AGENTS.md` was updated if the agent workflow or project rules changed.
- [ ] No secrets or unsupported claims were added to documentation.
- [ ] The final diff contains no unrelated changes.

In your final response, explicitly state which knowledge files were updated. If no update was needed, explain why. If documentation could not be updated, disclose the blocker and do not claim full completion.