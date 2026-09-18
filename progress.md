# 进度

## 2026-09-15

- 完成所有目标页面和对应美术资源盘点，输出 `reports/scene_audit.md`。
- 输出逐页制作规格 `docs/story-first-chapter-production-design.md`。
- 接通角色判定、模式分流、故事设置、RPG、普通交互、地图、真实战斗、统一结算和章节结束。
- 新增 StoryState 权威状态、pending-result 单次提交、存档恢复与 StoryHome 续玩。
- 新增全局 StoryTransition 和按钮交互反馈；处理实机发现的重复 pressed 信号。
- 将普通节点扩展为早上/中午/下午/晚上四段，完成 16 组本地剧情结果和时间推进过场。
- 新增专用玻璃破碎 WAV，RPG 穿越使用六张背景、逐字文本、闪白和黑屏。
- Map 改为数据驱动；战斗直接使用转盘完整快照，经现有术式/标签/牌组匹配链发牌，显示转盘角色并将胜负、伤势、CE、经验和成长送入统一结算。
- 依据 flow-v1 建立 `core-timeline-main-start-shibuya.json`，保存 W145、W171、W172、W36、W170、W93、W95-W97 及涩谷 W143/W132/W149/W148/W150/W151/W152/W153/W98/W69 等核心边界。
- 严格 Godot parse 通过；StoryFlowAcceptance、StoryInteractionAcceptance、StoryBattleCharacterAcceptance、check_story_flow、BattlePostStrategyInputAcceptance 通过。
- 生成并人工检查八张运行时截图；修复 Selection 遮挡、Settlement 底部溢出、标题重叠、Map 章节名和角色信息。
# 2026-09-15 — 联机 PvP 维修

- [x] 复现默认匹配赛报错并确定为 `queue_match` 协议缺失，而非角色快照、角色锁定或战斗权威故障。
- [x] 在 `preview-room-server.mjs` 实现匹配入队/取消、房间修订与 socket 房间状态广播。
- [x] 在 `RemoteOnlineRoomTransport` 接入真实协议；静态服务器选择不再发送不存在的后端请求。
- [x] 旧正式服务降级到邀请房间，使在线战斗在滚动部署前仍能使用。
- [x] 后端、双客户端端到端、远端直接房间、战斗阶段和 Godot 解析验收均通过。
- [x] 通过授权的生产发布渠道部署 `preview-room-server.mjs`、resolver 与 WebSocket 模块，并确认官方端点支持完整在线战斗。

## 2026-09-15 — 官方在线战斗完整同步修复

- [x] 部署官方 V3 resolver、room socket 和服务器端胜负字段。
- [x] 修复官方 Nginx WebSocket Upgrade/Connection 与 CORS 预检。
- [x] 修复 Godot WebSocket 首次 OPEN 订阅竞态，保留失败订阅并重试。
- [x] 官方 Node WebSocket 双端完成 strategy/discard/initiative/play/FINISHED，双方 winner 一致。
- [x] Godot 双端同步验收完成，revision、phase、winner 一致；本地权威服务回归通过。

## 2026-09-16 — 攻略型NPC垂直切片

- [x] 新增NPC数据层，区分剧情、战斗、增益、商人、情报、敌对、环境和攻略型NPC。
- [x] `StoryState` 保存NPC关系、路线阶段、个人事件旗标和是否成为伙伴。
- [x] 第一章时间行动与初级术师的好感、信任、认可和个人事件建立关系。
- [x] 新增攻略型NPC状态验收，验证从关系积累到 `recruit` 与 `companion=true`。
- [x] 将攻略型NPC援护牌注入真实 V3 战斗，保证每回合入手并正确结算40点护盾。
- [x] 战斗侧栏显示随行伙伴；统一结算显示NPC关系增减、路线阶段和伙伴解锁状态。
- [x] 真实窗口重拍8张故事流程图，人工复查伙伴战斗徽记与关系结算布局。
- [x] RPG框架读取原剧情盘核心节点数据，W145手动选择写入core_results并按源节点跳转。
- [x] W145结算后地图不再重复打开同一节点；W171/W172等未制作节点显示预留提示。
- [x] 从原始 `wheels.json` 接入 W171 三选项和 W172 四选项，动态扩展 RPG 选项按钮并验证学生/非学生分流。
- [x] 验收地图在 W145 后正确指向 W171 预留节点，不会因静态按钮定义回退到 W145。
- [x] 补齐文件1的随机、分支、高危节点定义和逻辑链；随机使用隐式转盘，分支使用手动选择，高危复用真实战斗。
- [x] 让隐式转盘结果生成后续可选行为，并支持剧情旗标、资源和成长条件过滤；修复高危路线无法解锁章节完成入口。
- [x] 新增第一章图结构验收，检查8类节点、场景资源、所有 next/choice/map 前置引用以及随机权重。
- [x] 接入 W96/W97、W143、W132、W149、W148，并验证高专路线从幼鱼与逆罚推进到涩谷开场与影响节点。
- [x] 接入 W150/W151/W152/W153/W98/W69，完成高专、非高专、宿傩和涩谷后状态的结果分流；核心结果会写入资源与旗标。
- [x] 将文件2中明确“对战”的 W148/W98 选项接入 `core_battle_*` 真实战斗桥，按敌方角色资源映射并在战后回到原核心时间线。
- [x] 将 W93/W69 的伤势与死亡文本转为真实剧情条件：重伤会封锁涩谷或死灭回游入口，牺牲会记录角色死亡。
- [x] 接入源时间线中的五条状态、羂索计划、改写世界线三个收敛节点，并让其旗标影响宿傩线和后续时期条件。
- [x] 接入源时间线 `shibuyaOutcome` 加权结局：三项原始结局使用本地可复现抽取并写入世界状态。
- [x] 加权结局按涩谷阵营旗标提高对应胜利项权重，保持源文件等权基础与局内可复现性。
- [x] 接入文件2 `cullingGame` 首段：死灭回游可发生性判断、改写替代结局、W144参加选择与W55地点选择。
- [ ] 制作伙伴独立立绘槽、专属入场动画、语音和第2章正式招募RPG节点。

## 2026-09-16 - 文件1节点数据驱动

- [x] 开局 RPG 节点在 `chapter1.json` 中声明有限选择，运行时生成按钮并进入 Selection。
- [x] 线索 RPG 节点在 `chapter1.json` 中声明对白、手动选项及资源/成长/关系变化。
- [x] `RpgFlow` 对普通剧情节点统一执行数据驱动解析，结果进入 Settlement 并由 `StoryState` 单次提交。
- [x] 新增 `Chapter1DataDrivenAcceptance.gd`，验证开局/线索选项生成和结算状态写入。
- [x] Selection AI 模式接入 `StoryAiProvider` 预留接口；provider 不可用时自动回退固定本地逻辑，并验证输入框与回退结果。
- [x] 文件2死灭回游补齐 W54 术式觉醒、W70 受肉对象、W107 特级地点、W127 弱者结果、W72 常规结果，并按角色标签自动分流。
- [x] 新增 `CullingSpecialRoutesAcceptance.gd`，回放无术式受肉线和特级专属线。
- [x] W145 写入 `joined_high_school`，补齐高专专属 W73/W74 守卫天元链，并验证后续进入 W144。
- [x] 新增 `CullingTengenAcceptance.gd`，验证加入高专→守卫天元→W74 结果的核心选择链。
- [x] 修正 `core_culling_gate` 条件：W73/W74 只对 `joined_high_school=true` 的路线出现，非高专路线直接进入 W144。
- [x] 增加 `protagonist_dead` 的终止收束节点，死亡状态可明确结算并写入 `run_terminal`。
- [x] 新增 `CullingDeadEndAcceptance.gd`，验证死亡状态不会卡在死灭回游入口。
- [x] 地图层识别 `run_terminal`，死亡收束存档不可重新进入 W145 或其他核心节点。
- [x] 新增 `TerminalMapAcceptance.gd`，验证终止状态的地图提示和阻断行为。
- [x] 增加文件1/文件2运行时一致性校验：映射节点、sourceWheelId、顺序和 `aiMayResolve=false` 均在 `StoryState` 启动时核对。
- [x] 修正 `core_shibuya_outcome` 缺失 `aiMayResolve=false` 的配置问题。
- [x] 将文件2正式扩展为 `mainStart`、`shibuya`、`cullingGame` 三段，并把死灭回游29个核心节点纳入运行时一致性校验。

## 2026-09-17 - 文件1节点入口与AI普通模式

- [x] 新增 `StoryState.scene_for_node()`，按节点类型统一解析文件1全部节点的进入场景。
- [x] StoryHome 与 Map 改用统一节点路由，新增节点无需修改页面 ID 白名单。
- [x] 修复 Settlement 关系和路线渲染调用，物品、NPC关系和下一节点信息与资源/成长一起展示。
- [x] 故事设置页开放 AI 普通节点模式，Selection 读取并保持玩家选择。
- [x] 增加 AI 响应清洗边界，只允许白名单资源/成长与受限文本，越权字段回退本地逻辑。
- [x] 新增场景路由、AI模式和AI清洗验收，相关 Godot 测试全部通过。
- [x] 全量验收文件2的8个涩谷核心战斗 profile，均可通过真实 BattleFlowSession 启动并完成角色/发牌初始化。
- [x] 将核心战斗敌方映射集中到 StoryBattleAdapter，战斗运行时与验收使用同一 profile 解析规则。
- [x] 第一章分支新增“回应术师的承诺”隐藏选项，完成攻略型 NPC 正式招募并解锁真实伙伴援护；新增路线验收通过。

## 2026-09-17 - 第一章内容包

- [x] 生成 `data/story/chapter1_background_plan.json`，按 RPG 序幕、四时段、剧情/随机/分支、地图、结算、攻略型 NPC 和核心预留分类列出 20 个背景位，并标记现有/待制作状态、节点用途和美术 brief。
- [x] 写入 `docs/story/chapter1-content-design.md`，明确第一章主线节拍、Galgame 式好感度结构、攻略条件、NPC 分工、AI 边界、对话分配和结算/小说规则。
- [x] 扩展 `data/story/npc_dialogue.json`，加入河岸目击者、咒具商人的阶段对白和交互选项；保留初级术师的个人事件、招募事件和援护解锁路线。
- [x] 新增 `Chapter1ContentPackageAcceptance.gd`，验证背景清单、内容设计关键词、三条 NPC 路线以及角色/经历报告。

## 2026-09-17 - 故事模式 UI 与战斗边界回归修复

- [x] StoryHome 底部导航、内置/登录卡角色选择、章节卡三态显示完成。
- [x] Identity 评级印章、姓名编辑、阵营/特质/咒具/普通标签、年龄/性别剪影及长文本布局完成。
- [x] RPG 正文点击区域、选择按钮层级、战斗选项可见性和 Speaker 居中修复；Selection 结果先展示再推进时段。
- [x] Settlement 的 Review 承载角色数值报告、事件/小说报告，Map 完成节点显示灰色蒙层并避免重复奖励。
- [x] 音乐播放器在曲目结束时自动循环；BattleFlowCoordinator/FightPresenter 对网络边界数据使用安全 Dictionary/Array 转换。
- [x] 回归验证：`SETTLEMENT_REPORTS_UI_ACCEPTANCE PASS`、`STORY_UI_CONTRACT_ACCEPTANCE PASS`、`BATTLE_BOUNDARY_CAST_ACCEPTANCE PASS`、`STORY_INTERACTION_ACCEPTANCE PASS`、`FULL_STORY_RUN_ACCEPTANCE PASS visited=32 history=32 battles=2 scenes=true current=chapter1_end`。

## 2026-09-17 - 全页面逻辑与按钮审计

- [x] 新增 `PageButtonWiringAudit.gd`，运行时实例化 17 个正式页面并检查所有 BaseButton 的连接、可用状态、键盘焦点、标签/提示和反馈元数据。
- [x] 修复战斗角色选择场景尾部损坏与缺失引号，页面由无法加载恢复为正常实例化；修复两处非法 BBCode 初始文本。
- [x] 底部导航统一增加入口提示和悬停/点击反馈；登录、转盘时间设置、Identity 保存/重抽、四时段行动和战斗退出图标补齐提示。
- [x] 结果：`PAGE_BUTTON_WIRING_AUDIT PASS pages=17 buttons=371 load_errors=0 unbound=0`；157 个当前可操作按钮无焦点缺失、无无文字/无提示项。
- [x] 场景导航引用审计通过：196 个 `.tscn` 引用，缺失目标 0。
- [x] 输出 `docs/ui-page-logic-audit.md` 与 JSON/日志证据到 `reports/ui-audit/`。
# 2026-09-17 页面逻辑与呈现复核

- [x] 复核 17 个正式入口页面、371 个按钮的绑定、焦点、提示与目标场景。
- [x] 补齐结算长回顾滚动容器、章节完成结局 CTA、策略二次确认、身份元信息栅格、时段行动/结果反馈与 RPG 继续提示。
- [x] 通过故事呈现、全故事运行与真实窗口流程验收。
- [ ] 清理项目遗留 invalid UID 元数据，并补多分辨率和 Web 导出旅程验收。
