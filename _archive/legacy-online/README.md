# legacy-online

`LocalBattleCommandGateway.gd`：本地单机的“服务器”适配器。

**归档原因**：全仓 0 处代码引用（仅 `battle/online/README.md` 与
`BattleCommandGateway.gd` 的注释文本提到它）。当前离线路径走
`BattleFlowCoordinator` 直接调用 `BattleFlowSession`，联机路径走
`OnlineRoomGateway` + 远端 transport，该网关已无接入点。

本目录含 `.gdignore`，Godot 不会扫描它。
