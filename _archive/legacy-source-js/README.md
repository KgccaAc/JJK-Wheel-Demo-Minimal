# legacy-source-js

源项目 JavaScript 参考实现（12 个文件，约 2.2 MB）。

**归档原因**：全仓对字符串 `source-js` 的引用数为 0；GDScript 侧
（`battle/core/BattleFlowSession.gd`、`battle/data/CharacterResources.gd`）
只在与源码注释对照时提到 `duel-resource.js` / `duel-counter-pipeline.js`
等**文件名文本**，不读取这些文件。规则逻辑已完整移植为 GDScript。

本目录含 `.gdignore`，Godot 不会扫描它。
