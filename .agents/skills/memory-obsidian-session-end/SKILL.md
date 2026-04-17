---
name: memory-obsidian-session-end
description: Use when the user asks to save the conversation, end the session, flush memory, or store the dialogue into memory-obsidian. This skill acts as a session-end hook. Extract a concise markdown summary of the conversation, then run scripts/end_hook.py to append it to daily/YYYY-MM-DD.md and update knowledge/log.md.
---

# Memory Obsidian Session End

## Purpose

Act as a `SessionEnd` hook for the `memory-obsidian` knowledge base. When triggered, save a summary of the conversation to the daily log and update the knowledge base tracking files.

## Trigger

This skill activates when the user says anything like:
- "Сохрани диалог в memory-obsidian"
- "Закончи сессию"
- "Flush memory"
- "Session end"
- "Save this conversation"
- "Выгрузи диалог в память"

## Procedure

1. **Summarize the conversation.** Create a concise markdown summary covering:
   - **Context:** What was the user working on?
   - **Key Exchanges:** Important Q&A or discussions
   - **Decisions Made:** Any decisions with rationale
   - **Action Items:** Follow-ups or TODOs
2. **Run the end hook.** Pipe the summary into `.agents/skills/memory-obsidian-session-end/scripts/end_hook.py` via stdin.
   - Example command (from project root):
     ```bash
     echo "<summary>" | python .agents/skills/memory-obsidian-session-end/scripts/end_hook.py
     ```
3. **Update knowledge pages if needed.** If new concepts or connections emerged during the session, create or update `knowledge/concepts/` and `knowledge/connections/` articles, then update `knowledge/index.md`.

## Important

- Always append to the existing daily log rather than overwriting it.
- If new knowledge articles were created during the session, ensure they are linked in `knowledge/index.md`.
- Do NOT truncate or drop previous daily log entries.
