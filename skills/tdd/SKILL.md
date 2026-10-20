---
name: tdd
description: Build or change code using a red-green-refactor loop.
mode: manual
---

# TDD

Use when implementing a feature or fix where tests can express the desired behavior.

## Flow

- Write the smallest failing test against the public interface.
- Make it pass with the least code.
- Refactor while keeping the test green.
- Prefer integration-style tests over implementation details.

## Keep It Lean

- Test behavior, not internals.
- One vertical slice at a time.
- End with the regression test that protects the fix.

## Mode

- `manual` only.

## Manual Trigger

- Users may invoke this skill manually with `/tdd`.
- Manual invocation starts a TDD pass even if the agent would not select it automatically.
