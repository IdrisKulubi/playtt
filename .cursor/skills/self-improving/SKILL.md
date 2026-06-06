---
name: self-improving
description: Captures and applies project learnings when run commands fail, structure changes, or the user corrects outdated agent knowledge. Use after fixing setup issues, discovering new conventions, or when project docs and skills are wrong or incomplete.
---

# Self-Improving Project Knowledge

Keep PlayTT agent docs accurate as the codebase evolves. Apply this skill when you discover something the skills or agents got wrong.

## When to trigger

- A run command fails due to outdated instructions
- A file path, script name, or env var has changed
- The user corrects agent behavior or project facts
- A new convention or folder pattern emerges
- An integration moves from planned to implemented (or vice versa)

## Workflow

```
Detect → Classify → Update → Verify → Confirm
```

### 1. Detect

Identify what is wrong: command, path, env var, convention, or missing feature status.

### 2. Classify

| Learning type | Update target |
|---------------|---------------|
| Run/setup commands, env vars | `.cursor/skills/run-project/` |
| Folder structure, where to add code, routes | `.cursor/skills/code-structure/` |
| Agent-specific behavior or scope | `.cursor/agents/<agent>.md` |
| Project entry point or routing | Root `AGENTS.md` |
| One-off edge case or historical note | `learnings.md` in this folder |

### 3. Update

- Edit the **smallest** relevant file.
- Keep skills concise (under 500 lines).
- Prefer updating structured skills over appending to `learnings.md`.
- Never store secrets, API keys, or real connection strings.

### 4. Verify

- Re-run the command that failed, or re-check the path that was wrong.
- Confirm the updated doc matches the actual codebase.

### 5. Confirm

Tell the user:
- What was wrong
- Which file(s) were updated
- What was changed

## Auto-update vs ask first

**Auto-update** (factual fixes):
- Wrong paths, command names, script flags
- New env var discovered in code
- Route added or removed
- Expo version doc link change

**Ask first** (structural changes):
- Reorganizing folder conventions
- Adding new subagents
- Large rewrites of skills
- Changing agent scope or responsibilities

## learnings.md format

When a learning does not fit a structured skill, append to [learnings.md](learnings.md):

```markdown
## YYYY-MM-DD — Short title
- **Context:** what happened
- **Fix:** what was learned
- **Updated:** which skill/agent file (if any)
```

## Maintenance rules

- Periodically promote recurring `learnings.md` entries into the appropriate skill.
- When Expo SDK version changes, update `mobile-dev.md` doc link and `run-project` if scripts change.
- When a planned integration is implemented, update `code-structure/reference.md` and remove it from the "planned" table.
- When adding `.env.example`, update `run-project/env-reference.md` to reference it.

## Related files

| File | Purpose |
|------|---------|
| `learnings.md` | Chronological log of one-off discoveries |
| `.cursor/skills/run-project/` | How to run apps |
| `.cursor/skills/code-structure/` | Where code lives |
| `.cursor/agents/` | Subagent prompts |
| `AGENTS.md` | Repo entry point |
