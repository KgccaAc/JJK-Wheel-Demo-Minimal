# 登录卡组件

`LoginCardPngCodec` 读取源项目 PNG `tEXt` 块中 `jjk-login-card` 的 `base64:` JSON。
`LoginCardCharacterProjector` 将登录卡 entry / `card` 快照投影到 Godot 战斗资料；原始内容保留在 `canonicalV3`，任何缺属性或不合法手札都会记录到 `snapshot_errors`，不会静默变成内置角色。

`LoginCardCharacterCache` 是活动卡的本地运行时覆盖层，写入 `user://login-card-characters.json`；内置表不被修改。`LoginCardSyncGateway` 只定义源项目兼容的版本化封包和端点，不保存访问令牌，也不会把未接入服务端的请求报告为成功。

源项目的普通转盘只生成记录，角色入卡来自自定义角色页的显式保存。比赛卡抽取使用 `LoginCardDrawTransaction`：抽取完成后进入 `grade_pending_store`，只能显式保存，或在服务器确认后放弃；两者都不会自动覆盖卡内角色。保存后使用 `upsert_character`（revision + snapshotHash），冲突时保留本地内容并请求处理。新项目不将转盘文本自动写入角色卡。

