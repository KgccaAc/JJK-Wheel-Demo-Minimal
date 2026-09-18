# 第一章精细制作计划与完成状态

## 目标流程

`wheel -> identity -> Select -> StroyHome -> RPG -> Selection四时段 -> 统一结算 -> Map -> RPG节点 -> 统一结算 -> Map -> battle -> 统一结算 -> Map/章节结束`

逐页视觉、操作、转场、状态读写和验收规格见 `docs/story-first-chapter-production-design.md`。

## 已完成

- [x] 盘点 identity、Select、StroyHome、RPG、Selection、Map、battle、settlement 场景和美术目录。
- [x] 首页移除剧情 Demo；“故事模式”直达 StroyHome。
- [x] 转盘结果通过 identity 统一传到 Select、StroyHome、Map 和 battle 显示层。
- [x] 全局按钮悬停/焦点/按压动画和防重复切页淡出。
- [x] RPG 通用对白框架、逐字显示、六张背景、闪白、黑屏、专用玻璃破碎音效。
- [x] Selection 早中下午晚四段，每段四个本地行动，共 16 组剧情与数值结果；AI入口锁定并保留。
- [x] Map 从 chapter1.json 读取按钮到节点、前置条件和场景路径；未制作节点保持锁定。
- [x] 真实 battle 故事适配与胜负/撤退结算。
- [x] settlement 作为唯一奖励提交点，展示资源、成长、经历和下一节点。
- [x] NPC按剧情、战斗、增益、商人、情报、敌对、环境和攻略型分类；攻略型NPC保存好感、信任、认可、默契、路线旗标和随行状态。
- [x] 攻略型NPC通过时间行动与RPG选择积累关系，达到条件后成为伙伴；伙伴援护牌进入真实角色投影、发牌和V3战斗结算，战后关系回到统一结算。
- [x] 保存/读取、幂等提交、从 StoryHome 继续当前节点。
- [x] 从原 flow-v1 提取 mainStart 至 Shibuya 核心节点边界，明确禁止 AI 选择。
- [x] 严格解析、逻辑验收、四时段实走、战斗输入验收和八页实机截图。
- [x] 第一章背景资源分类清单 `data/story/chapter1_background_plan.json`。
- [x] 第一章内容设计、Galgame 式攻略路线和 NPC 交互设计 `docs/story/chapter1-content-design.md`。
- [x] 河岸目击者、咒具商人交互对白与选项写入 `data/story/npc_dialogue.json`。
- [x] 内容包验收 `tests/godot/Chapter1ContentPackageAcceptance.gd`。
- [x] 故事模式导航、角色选择、Identity 评级/字段展示、RPG 点击层、Selection 结果节奏、Settlement 双报告、Map 完成态和战斗边界转换修复；对应 UI/边界/完整流程验收全部通过。
- [x] 对 17 个正式页面执行按钮连接、键盘焦点、文字/提示和跳转目标审计；371 个按钮节点无漏绑，196 个场景引用无悬空目标。
- [x] 修复 `battle/character_selection.tscn` 损坏文本导致的加载失败和初始 BBCode 错误，并补齐底栏、登录、转盘、行动、Identity 与战斗退出按钮提示。
- [x] 输出逐页逻辑与按钮审计 `docs/ui-page-logic-audit.md`，列明完成状态与后续 P2 优化项。

## 本章边界

河岸事件是教学桥接剧情，不冒充原转盘核心结果。第一章结束后下一节点固定对接原剧情盘 W145“是否加入高专”。Normal、Hard 与 AI 模式继续锁定，但工程接口和状态字段已保留。
