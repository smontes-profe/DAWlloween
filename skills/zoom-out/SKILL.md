---
name: zoom-out
description: Step back and re-evaluate scope, architecture, or direction before committing.
mode: manual
---

# Zoom Out

Use when the work feels too local, the design is unstable, or a change could ripple across the scaffold.

## Flow

- Summarize the higher-level problem.
- List a few viable approaches.
- Call out long-term maintainability and context cost.
- Recommend the smallest option if uncertainty remains.

## Auto Policy

- Use automatically just before `implement`.
- Use automatically when the stories and tasks are already defined and the work is about to move from definition to delivery.
- Use automatically to check consistency with the implemented project, the architecture, and any shared abstractions.
- Stop using it when the user explicitly wants to move on to `implement`.
- Do not use automatically if no architecture, consistency, or cross-cutting risk is visible.

## Manual Trigger

- Users may invoke this skill manually with `/zoomout`.
- Manual invocation forces a consistency review before implementation.

## Keep It Lean

- Do not overexplore.
- Prefer decision support over exhaustive analysis.
- Return to the concrete task once the direction is clear.
