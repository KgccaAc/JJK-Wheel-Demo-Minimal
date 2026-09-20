# 联机房间核心目标与关键路径

## 核心目标

联机房间不是一个“把两个玩家送进战斗场景”的跳转页。它要完成四个连续职责：

1. 把玩家当前选择的角色快照和独立身份绑定到一个 1v1 房间。
2. 让房主和加入者看到同一份权威房间状态，并能在断线后重新同步。
3. 只有双方角色都锁定后，才创建联机战斗上下文并进入战斗页面。
4. 战斗输入由双方提交，预览服务器推进权威阶段、revision、胜负和 `FINISHED`；客户端只呈现授权给本方的投影。

## 玩家关键路径

```text
登录/游客会话
  -> 首页
  -> 联机模式
  -> 自建房间 / 匹配赛
  -> 官方服务器选择（默认官方预览）
  -> create_room
  -> 复制房间码
  -> 另一页面 join_room
  -> 双方看到对手角色快照
  -> 双方 lock_character
  -> room.state = battle_ready
  -> OnlineBattleContext
  -> get_battle_bootstrap + WebSocket subscribe_room
  -> 双方提交策略、弃牌、先手和出牌
  -> 权威回合结果广播
  -> FINISHED / winner
```

## 客户端与服务端边界

`OnlineRoom.gd` 负责页面状态、按钮接线、角色快照打包、房间状态展示和进入战斗；`RemoteOnlineRoomTransport.gd` 把页面操作映射为 V3 API 操作；`RemoteOnlineRoomSocket.gd` 负责订阅房间状态和战斗广播；`FightPresenter.gd` 与 `BattleFlowCoordinator.gd` 把在线上下文接到真实战斗 UI。

服务端 `backend/preview-room-server.mjs` 是房间与战斗权威。HTTP `POST /preview-room-api/api/rooms` 处理建房、入房、锁角、战斗输入和同步；WebSocket `/preview-room-api/api/rooms/socket?roomId=...` 只处理订阅、房间变化和战斗事件广播。客户端不决定房间 revision、对手快照、胜负或奖励。

## 状态门槛

| 阶段 | 必须成立 | 失败时的用户结果 |
| --- | --- | --- |
| 进入页面 | 游客/登录卡会话有效，服务器为官方预览 | 页面保留错误提示，不能伪造在线成功 |
| 建房 | 角色快照非空，服务端返回 `roomId` 和 revision | 显示服务端错误编号 |
| 入房 | 房间存在且未满，双方 identity 不同 | 显示 `ROOM_NOT_FOUND` / `ROOM_FULL` |
| 锁角 | 本方角色快照已上传且锁定请求被接受 | 保持准备阶段，不进入战斗 |
| 开战 | 房间状态为 `battle_ready` | 不允许跳过锁角直接进入战斗 |
| 战斗 | HTTP 输入成功，WebSocket revision 连续 | 发生 stale 时 resync，不使用本地假结果 |
| 结算 | 服务端广播 `FINISHED` 且 winner 非空 | 只有权威结果可显示胜负 |

## 固定入口脚本

`tools/run_web_online_entry.ps1` 启动当前 Web 包、本地静态服务和公开预览 API 代理，然后调用 `tests/web/online_entry_flow.py`。脚本固定执行登录页 -> 游客登录 -> 首页 -> 联机模式 -> 自建房间页，并为每一阶段写入截图和 `online-entry-flow.json`。

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run_web_online_entry.ps1 -Headed
```

需要同时验证两个浏览器页面时使用默认 `-Pages 2`；只检查单页入口可使用 `-Pages 1`。`-CreateRoom` 才会向预览房间 API 创建一次测试房间，默认入口脚本只检查页面路径，不修改任何正式服务状态。

## 现阶段证据与风险

官方预览健康检查、HTTP 建房/入房/完整战斗、Node WebSocket 双端、Godot 双端同步到 `FINISHED` 已有通过证据。浏览器 Web 前端此前暴露出本地 Origin 未被预览服务允许的问题，固定脚本通过本地公开 API 代理解决浏览器同源和 CORS 适配；代理只访问 `https://119.91.224.223/preview-room-api`，不访问服务器内部端口。浏览器双页面的真实“建房 -> 入房 -> 锁角 -> 战斗 -> 结算”仍需在入口脚本完成后单独记录终局截图。
