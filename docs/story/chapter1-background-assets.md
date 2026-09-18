# 剧情背景图分类计划

本清单覆盖 `data/story/chapter1.json` 与 `data/story/core-timeline-main-start-shibuya.json` 的可见剧情范围。背景图按“场景用途”规划，RPG 页面、地图、战斗和结算页面复用已有框架；内容背景采用统一的 16:9、1920×1080、可叠加角色立绘与对白框的构图。

## A. 已有并直接复用

| 分类 | 文件 | 使用节点 | 状态 |
| --- | --- | --- | --- |
| 穿越序列 | `art/Story/RPG/初始背景/1.png` | `chapter1_intro` 签名会 | 已有 |
| 穿越序列 | `art/Story/RPG/初始背景/2.png` | 芥见与签名本 | 已有 |
| 穿越序列 | `art/Story/RPG/初始背景/3.png` | 缝合额头与束缚 | 已有 |
| 穿越序列 | `art/Story/RPG/初始背景/4.png` | 闪白/断片 | 已有 |
| 穿越序列 | `art/Story/RPG/初始背景/5.png` | 仙台路牌 | 已有 |
| 穿越序列 | `art/Story/RPG/初始背景/6.png` | 记忆疼痛、落地 | 已有 |
| 普通节点 | `art/Story/Select/序章场景图/郊区.png` | `chapter1_selection` 四时段 | 已有 |
| 地图 | `art/Story/Map/地图.png` | `chapter1_map` 与核心地图 | 已有 |
| 结算 | `art/Story/通用结算/*` | 所有事件、剧情、战斗结算 | 已有 |
| RPG 框架 | `art/Story/RPG/文本栏.png`、`发言人.png`、`选项按钮.png` | 所有 RPG 节点 | 已有 |

## B. 第一章必须制作的内容背景

| 资源 ID | 建议文件 | 画面内容 | 使用节点 |
| --- | --- | --- | --- |
| `sendai_morning_street` | `art/Story/RPG/第一章/仙台街道_清晨.png` | 便利店、公交站、湿润路面，留出右侧对白空间 | `chapter1_selection` 早上 |
| `sendai_noon_street` | `art/Story/RPG/第一章/仙台街道_正午.png` | 人流与橱窗反光，光线强、残秽不可见 | `chapter1_selection` 中午 |
| `sendai_evening_street` | `art/Story/RPG/第一章/仙台街道_黄昏.png` | 拉长的电线杆影子，黑影方向明确 | `chapter1_selection` 下午 |
| `sendai_night_street` | `art/Story/RPG/第一章/仙台街道_夜.png` | 路灯、空街、远处河岸入口 | `chapter1_selection` 晚上 |
| `river_entrance` | `art/Story/RPG/第一章/河岸入口.png` | 封闭步道、警示带、护栏爪痕 | `chapter1_clue` |
| `river_underpass` | `art/Story/RPG/第一章/河岸桥下.png` | 桥下积水与目击者藏身处 | `chapter1_optional_event` |
| `tool_trader_backdoor` | `art/Story/RPG/第一章/便利店后门.png` | 后门货箱、咒具商人、低色温灯 | `chapter1_optional_event` |
| `river_deep_curse` | `art/Story/RPG/第一章/河岸深层残秽.png` | 水面裂口、黑影成形、战斗前景 | `chapter1_danger` |
| `sendai_after_battle` | `art/Story/RPG/第一章/河岸战后.png` | 雨停后的河岸、损坏护栏、初级术师现身 | `chapter1_end` |

## C. 核心剧情盘·剧情开始时期至涩谷

这些资源服务核心 RPG 节点；战斗节点继续使用真实战斗场景的战斗背景，不在 RPG 背景中伪造战斗。

| 资源 ID | 建议文件 | 主要节点 |
| --- | --- | --- |
| `tokyo_high_school_gate` | `art/Story/RPG/核心/东京高专校门.png` | W145、W171 |
| `kyoto_high_school_hall` | `art/Story/RPG/核心/京都校训练场.png` | W171 |
| `fukuoka_training_room` | `art/Story/RPG/核心/福冈校训练室.png` | W171 |
| `high_school_campus_night` | `art/Story/RPG/核心/高专夜间走廊.png` | W172、W36 |
| `exchange_event_arena` | `art/Story/RPG/核心/交流会场地.png` | W170、W93 |
| `junpei_school_corridor` | `art/Story/RPG/核心/学校走廊.png` | W95、W96、W97 |
| `mahito_station` | `art/Story/RPG/核心/车站地下通道.png` | W97 |
| `shibuya_station_before` | `art/Story/RPG/核心/涩谷站前_封锁前.png` | W143、W149 |
| `shibuya_station_barrier` | `art/Story/RPG/核心/涩谷站_帐幕.png` | W132、W148 |
| `shibuya_command_post` | `art/Story/RPG/核心/涩谷指挥点.png` | W150、W151 |
| `prison_realm_platform` | `art/Story/RPG/核心/狱门疆平台.png` | W150、W151、W152 |
| `shibuya_aftermath` | `art/Story/RPG/核心/涩谷事变后街区.png` | W69、结局收束 |

## D. 死灭回游预留背景

| 资源 ID | 建议文件 | 主要节点 |
| --- | --- | --- |
| `tengen_barrier_chamber` | `art/Story/RPG/死灭回游/天元结界室.png` | W73、W74 |
| `colony_gate` | `art/Story/RPG/死灭回游/结界入口.png` | W144、W55 |
| `sendai_colony` | `art/Story/RPG/死灭回游/仙台结界.png` | W107、W55、W72 |
| `tokyo_colony` | `art/Story/RPG/死灭回游/东京结界.png` | W55、W72 |
| `reincarnation_ritual` | `art/Story/RPG/死灭回游/受肉仪式场.png` | W70 |

## E. 制作规范与导入规则

1. 文件名使用上表英文资源 ID 对应的中文展示名，导出后保持 PNG；同一场景的清晨/正午/黄昏/夜间使用同构图和不同光照。
2. 前景至少保留 35% 的干净区域给对白框，关键线索放在画面中部偏左，避免被角色立绘遮挡。
3. 每张背景只表达一个地点状态；残秽、结界、倒影等动态效果放到 Godot 的叠加层，避免重复绘制多份背景。
4. 新资源落盘后，先在 `chapter1.json` 的节点中以 `background` 字段声明，再由 RPG 框架读取；缺图时回退到对应分类的已有背景，不阻塞剧情链。
5. 第一章完成顺序：B 类 9 张 → C 类 12 张 → D 类 5 张。战斗专用背景由战斗资源表单独维护。
