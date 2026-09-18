# 本地背景音乐映射

这些 MP3 由项目所有者在本机提供的 AAC 文件转码而来，供当前本地构建使用。`AudioManager` 统一管理播放与开关，场景不直接持有播放器。

| 场景或条件 | 文件 |
| --- | --- |
| 登录页 | `login_blue_sumi_ka.mp3` |
| 从登录进入的主菜单 | `menu_lost_in_paradise.mp3` |
| 普通战斗随机曲池 | `battle_specialz.mp3`、`battle_kaikai_kitan.mp3`、`battle_aizo.mp3` |
| 任一方为五条悟 | 50% 概率使用 `battle_gojo_shinjuku.mp3`，否则仍从普通战斗曲池随机 |

运行时通过主菜单右上角“更多”分别开关背景音乐和音效。设置中还提供两个无级分贝滑块：音乐最高为 -8 dB，音效最高为 +4 dB。音效来自 `../groups/LIKE/`；音乐和音效映射写在 `res://audio/AudioManager.gd`。

这些音乐不属于本仓库的 CC0 音效库。发布、上传或分发构建前，应确认你拥有相应的音乐授权，或替换为可分发音乐。

