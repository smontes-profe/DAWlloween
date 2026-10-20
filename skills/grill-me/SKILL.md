---
name: grill-me
description: Stress-test a user story, epic, or design before writing specs or code.
mode: auto
---

# Grill Me

Use when the user needs help turning an idea into a clear story, epic, or plan.

## Goal

Remove ambiguity with the smallest useful set of questions.

## Auto Policy

- Use automatically at the start of `spec` and `plan`.
- Use automatically when a new epic or user story is introduced and it still needs scope sharpening.
- Use automatically when acceptance criteria, constraints, or dependencies are unclear.
- Stop using it when the user explicitly says they want to close `spec` or `plan`.
- Do not use automatically for trivial edits, already-specified implement/test work, or when the user explicitly wants execution now.

## Manual Trigger

- Users may invoke this skill manually with `/grillme`.
- Manual invocation forces a clarification pass even if the agent would not have selected it heuristically.

## Process

- Clarify the outcome.
- Identify actors, constraints, dependencies, and non-goals.
- Surface tradeoffs and hidden edge cases.
- Stop once the next spec or plan can be written without guessing.

## Do Not

- Start implementing.
- Ask endless open-ended questions.
- Collect details that do not change the decision.

## Output

- A concise summary of the clarified scope.
- Any unresolved decisions.
- The best next step: spec, plan, or task split.
