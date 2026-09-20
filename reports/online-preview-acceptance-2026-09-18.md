# 预览联机功能验收（2026-09-18）

## 范围

- 仅访问 `https://119.91.224.223/preview/` 和 `https://119.91.224.223/preview-room-api`。
- 未访问、修改或部署正式根服务。
- 验收对象：匹配队列、自建房、角色锁定、HTTP 战斗、WebSocket 双端同步、Godot 客户端同步、Web 导出双页入口。

## 结果

| 项目 | 结果 | 证据 |
|---|---|---|
| 预览前端入口 | PASS | `GET /preview/` 返回 HTTP 200 |
| 房间服务健康 | PASS | `GET /preview-room-api/health` 返回 `ok=true`、`battleAuthority=true` |
| CORS 预检 | PASS | `OPTIONS /preview-room-api/api/rooms` 返回 204，按 Origin 回显 allow-origin |
| 官方预览匹配队列 | PASS | `OFFICIAL_MATCHMAKING_ACCEPTANCE PASS`；两方入队后同房，锁定后 `READY` |
| 官方预览自建房 HTTP 战斗 | PASS | `OFFICIAL_ONLINE_BATTLE_FULL_ACCEPTANCE PASS`；strategy/discard/initiative/play 到 `FINISHED`，winner 非空 |
| 官方预览 WebSocket 战斗 | PASS | `OFFICIAL_ONLINE_BATTLE_WEBSOCKET_ACCEPTANCE PASS`；双方事件和 winner 一致 |
| Godot 双端远程同步 | PASS | `ONLINE_BATTLE_FULL_SYNC_ACCEPTANCE PASS`；双方 revision/winner 一致 |
| Godot 远程入口 | PASS | `ONLINE_BATTLE_REMOTE_ACCEPTANCE PASS`；到达 strategy resolution |
| 并行 WebSocket 观察 | PASS | 2 场并行战斗均到 `FINISHED`，错误码 0 |
| Web 导出双页自建房 | PASS | Port 8098；Host 建房 HTTP 200、Guest 入房 HTTP 200，console/page error 均为 0 |

## 低并发观察

受控执行 4 条并发房间流程（创建、入房、双方锁定、清理），共 20 个 HTTP 请求：

- errors：0
- 总耗时：309 ms
- 平均请求：61 ms
- 最大请求：131 ms

这只能说明当前小规模观察下没有出现错误或明显延迟，不能替代带目标并发数、持续时间和 CPU/内存指标的正式容量压测。预览 `/metrics` 当前只提供应用计数器，没有服务器 CPU/内存/连接上限数据，因此不能据此承诺“任何流量下都不会高负载”。

## 指标说明

本次查询预览 `/metrics` 时：

- `submit_stage_input` 成功计数：317
- `submit_stage_input` 409：21
- `delete_room` 409：5
- WebSocket active：26；累计连接 82、断开 56
- 未看到 5xx 计数

这些 409 是累计计数，来自此前 stale revision/清理请求等保护性冲突；本次新跑的完整战斗脚本若出现 409 会直接失败，因此本次通过结果证明当前验收链路没有产生未处理的战斗阶段冲突。直接脚本清理房间时必须携带 `expectedRoomRevision`，否则会得到预期的 `ROOM_REVISION_CONFLICT`，不能把它当作服务崩溃。

## Web 导出说明

Playwright 记录到 `index.wasm` 和 `index.pck` 的 `net::ERR_ABORTED` 请求，但页面 `console_errors=[]`、`page_errors=[]`，并且建房/入房请求均为 200，流程状态为 `passed`。这是导出加载器在页面切换/关闭时的请求中止记录，不是联机 API 失败。

## 可复用命令

```powershell
node tests/backend/official_online_battle_full_acceptance.mjs
node tests/backend/official_online_battle_websocket_acceptance.mjs
& 'tools/godot-web-audit/Godot_v4.6.2-stable_win64_console.exe' --headless --path . --script res://tests/godot/OnlineBattleFullSyncAcceptance.gd --quit-after 30000
powershell -ExecutionPolicy Bypass -File .\tools\run_web_online_entry.ps1 -Port 8098 -CreateRoom -Pages 2
```

