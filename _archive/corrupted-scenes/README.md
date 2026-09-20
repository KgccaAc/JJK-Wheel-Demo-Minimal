# 损坏场景归档

本目录存放因编码损坏而退役的场景文件，**不应被任何生产代码引用**。

## fight.tscn（2026-09-20 归档）

- 原路径：`res://scenes/battle/fight.tscn`
- 性质：`battle_scene.tscn` 的损坏孪生副本
- 损坏：12 个中文美术路径全部为 mojibake（如 `鎴樻枟椤甸潰妗岄潰.png`），
  且这些残码路径在磁盘上均不存在（真实文件名为 `战斗页面桌面.png` 等）
- 损坏机制：UTF-8 字节流被按 CP1252/GBK 解释后**丢字节**，无法通过重新解码还原（已验证 0 条可逆）
- 退役原因：功能与 `battle_scene.tscn` 完全重复（21 个 ext_resource 一致），
  生产引用已被改指 `battle_scene.tscn`，测试引用已移除
