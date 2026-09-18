# Legacy Runtime

This directory is retained only for historical fixture and availability-preview
tests. Production combat state is owned by `battle/core/BattleFlowSession.gd`.
Do not add new rules here. AP fields and AP effects are deprecated and ignored
by the active flow.

`BattleRulesV1Session`, `TurnTransaction`, and `CardZoneManager` were removed:
their independent state advancement duplicated the production command path.
Fixture assertions must now drive `BattleFlowSession` through its public
commands and inspect its canonical snapshot or round package.

