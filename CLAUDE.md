# CLAUDE.md

## Webapp UI (alouette)

Never nest raised surfaces. `Surface` (and `SettingsSection`, which wraps it) and
`PressableListItem` / `PressableBox variant="contained"` each carry their own
`shadow-s`, background and radius, so one inside the other reads as a double
elevation.

- A list of pressable rows goes on the screen background, wrapped in
  `ListSection` for its heading.
- `Surface` / `SettingsSection` is for static content only.
