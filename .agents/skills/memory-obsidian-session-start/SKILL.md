---
name: memory-obsidian-session-start
description: Use when the user begins interacting with the memory-obsidian knowledge base or asks any question related to it. This skill acts as a session-start hook. BEFORE answering the user's request, ALWAYS run scripts/start_hook.py to load AGENTS.md, knowledge/index.md, and the latest daily log into context. Then proceed to fulfill the user's request using that loaded context.
---

# Memory Obsidian Session Start

## Purpose

Act as a `SessionStart` hook for the `memory-obsidian` knowledge base. Every time this skill triggers, the agent MUST first load the existing knowledge context and ONLY THEN execute the user's request.

## Trigger

This skill activates when the user:
- Mentions `memory-obsidian`, `memory obsidian`, or any of its subdirectories (`raw/`, `knowledge/`, `daily/`, `reports/`)
- Asks to ingest, compile, lint, or query the knowledge base
- Starts a new conversation thread that involves the knowledge base

## Procedure

1. **Run the start hook.** Execute `.agents/skills/memory-obsidian-session-start/scripts/start_hook.py` from the project root.
2. **Read the output.** The script prints `AGENTS.md`, `knowledge/index.md`, and the latest `daily/*.md` log.
3. **Fulfill the user's request.** Use the loaded context to answer or act. If the request involves creating/updating wiki pages, follow the rules from `AGENTS.md`.

## Important

- Do NOT skip the start hook step.
- Do NOT answer from general knowledge about memory-obsidian without first reading the local files.
