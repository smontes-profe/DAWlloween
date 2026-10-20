# Skills

This project includes a small skills bundle. `grill-me` is always installed, while `zoom-out` and `tdd` stay optional.

## Credits

These starter skills are adapted from `mattpocock/skills`, which is published under the MIT license.

## Installed

- `grill-me`: `auto`
- `zoom-out`: `manual`
- `tdd`: `manual`

`grill-me` is mandatory and is installed as `auto`.

## Mode Policy

- `auto`: the agent may use the skill proactively when the task clearly matches the policy in the skill file.
- `manual`: the agent should only load the skill when the user asks for it or when the task clearly calls for it.
- `none`: the skill was not installed.

## Triggers

- `/grillme` for clarification during `spec` and `plan`.
- `/zoomout` for the pre-implementation consistency review.
- `/tdd` for a manual red-green-refactor pass.
