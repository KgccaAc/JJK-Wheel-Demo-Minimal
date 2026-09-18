# 联机传输边界

`OnlineBattleProtocol.gd` 定义本地与线上共同使用的命令/权威更新契约；`LocalBattleCommandGateway.gd` 是当前离线权威实现。

`BattleTransportPayloads.gd` 将协议对象包装为版本化传输包，并剔除手牌、牌库、本地卡面路径和认证秘密。`RemoteBattleCommandGateway.gd` 仅预留真实服务端接入点；没有注入网络适配器时固定返回 `online_service_unavailable`，不会伪装成联机成功。

## 联机大厅接口

`OnlineRoomGateway.gd` 是房间和匹配页的 `online-battle-v3` 边界。战斗阶段只允许 `getBattleBootstrap`、`submitStageInput` 与 `resyncBattle`；客户端不能提交最终结算 receipt。HTTP/WebSocket 适配器必须实现 `request_online_room(packet)`，并将服务器返回的 Dictionary 原样交回网关。

网关未注入 transport 时固定返回 `online_service_unavailable`；它不会在本地生成房间、匹配对手或伪造权威状态。认证 token 必须由未来 transport 写入安全请求头，不能传入 UI payload 或保存进场景。

