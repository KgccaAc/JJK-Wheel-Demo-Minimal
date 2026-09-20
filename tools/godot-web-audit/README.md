# Godot 工具链占位目录

本目录原本包含 Godot 4.6.2 引擎与导出模板，合计约 **1,358 MB**：

| 文件 | 大小 |
|---|---|
| `Godot_v4.6.2-stable_export_templates.tpz` | 1,193.9 MB |
| `Godot_v4.6.2-stable_win64.exe` | 164.4 MB |
| `Godot_v4.6.2-stable_win64_console.exe` | 0.2 MB |

它们**已被移出项目**，不再占用工作目录空间。这三个文件本来就在 `.gitignore`
中排除，从未进入版本库，因此移出**不影响任何已提交内容**。

## 当前位置

```
C:\Users\<user>\Desktop\GodotToolchain\4.6.2\
```

## 为什么移出

工作目录体积曾是 2.2 GB，其中 1.36 GB 来自本目录。保留一份完整的引擎 +
导出模板副本对仓库没有价值（可通过官方渠道重新获取），却显著拖慢
克隆、备份、IDE 索引与磁盘镜像。

## 如何重新接入

### 方式一：环境变量（推荐）

项目脚本已优先读取 `JJK_GODOT`，无需修改任何文件：

```powershell
$env:JJK_GODOT = "C:\Users\KgccaAc\Desktop\GodotToolchain\4.6.2\Godot_v4.6.2-stable_win64_console.exe"
powershell -File tools/run_all_acceptance.ps1
```

> 注意：本项目使用 **C# (mono) 构建**（`config/features=PackedStringArray("4.6", "C#")`），
> 常规验收请使用 mono 版本：
> `C:\Users\KgccaAc\Desktop\Godot_v4.6.2-stable_mono_win64\Godot_v4.6.2-stable_mono_win64\Godot_v4.6.2-stable_mono_win64_console.exe`

### 方式二：重新下载

- 引擎：https://github.com/godotengine/godot/releases/tag/4.6.2-stable
- 导出模板：同发布页的 `Export Templates`

导出模板需要**安装到 Godot 的模板目录**，而不是放在项目内：

```
%APPDATA%\Godot\export_templates\4.6.2.stable\
```

## 注意

- 请勿把引擎或导出模板重新放回本目录。
- 若确有需要在本目录存放大型二进制，请先确认 `.gitignore` 已覆盖，并说明理由。
