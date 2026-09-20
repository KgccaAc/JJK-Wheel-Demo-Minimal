# 进度

## 2026-09-20 Web App Shell 与 AI 上下文边界

- [x] 新增可运行 `web-preview` 根页：统一导航、首页模块卡片、故事页面、错误边界和响应式布局。
- [x] 故事页通过 `StoryClient` 驱动版本化内容包，完成首节点选择并保存快照；战斗/转盘/联机暂以明确的模块边界和下一步接入提示承载，不伪造权威状态。
- [x] `?save=` 选择存档槽，故事存档 API 支持 `STORY_RUNTIME_DATA_DIR` 注入，验收不污染生产式本地目录。
- [x] 新增 `WEB_APP_SHELL_ACCEPTANCE PASS`：根页 200、故事选择、模块路由和浏览器控制台 0 错误。
- [x] 新增 AI 上下文边界验收：当前节点/NPC/关系/最近 6 轮进入请求，未来节点和完整故事包哨兵不进入 DeepSeek body。
- [x] `/api/ai/status` 明确返回 enabled、modelAvailable、fallbackMode；Key 仍只由后端读取。
- [x] Web 客户端只应用服务器确认的 AI effects；新增会话上限回归（3 次 2 XP 提案最终为服务器上限 5 XP），结束对话会恢复到战斗节点。

## 2026-09-20 Web 化/故事模块化/DeepSeek 首期垂直切片

- [x] 从现有 `chapter1.json`、NPC 与对白数据生成版本化 `story-package.v1`，保留旧类型和源文件映射。
- [x] 新增 `tools/validate_story_package.mjs`：校验入口、节点断链、战斗 encounter、资源引用和 AI 节点配置；不可达预留节点作为警告。
- [x] 新增无 DOM 的 `web-runtime/story-runtime.mjs` 与内容加载器，验证开局选项→四时段选择→地图推进，并提供战斗/AI 暂停恢复接口。
- [x] 新增 `/story-editor` vanilla Web 工作台：节点搜索、标题/对白/背景/选项/备注编辑、预览、校验和 JSON 导出；不改默认 Godot Web 静态根目录。
- [x] 新增后端 DeepSeek 对话服务：真实 `deepseek-flash` 请求、结构化回复、回退文本、效果白名单、会话修订冲突和事件账本。
- [x] 新增故事内容/存档预览 API：版本化内容包、章节读取、校验/预览和带 `expectedRevision` 的追加事件接口；不改正式联机房间代理。
- [x] 将 AI 效果白名单/上限写入 `data/story/ai-effect-policies.json` 并随内容包发布，后端规则继续做最终校验。
- [x] 补齐 `test:local-worker` 缺失验收脚本，并增加 `test:story-web`、`test:story-api` 统一回归入口。
- [x] 真实烟测使用 `C:\Users\KgccaAc\Desktop\KEY.txt` 临时注入环境完成；本次返回 `source=deepseek`、`fallback=false`，未输出或持久化 Key。
- [x] 无 Key 回归仍通过：`AI_DIALOGUE_ACCEPTANCE`、故事包校验和 Web 运行时测试通过。

文档：`docs/story/web-story-architecture.md`。

## 2026-09-19 工作区恢复与手牌 AP 历史残留清理

- [x] 重新获取项目工作区、GitHub remote、Godot 4.6.2 和现有交接/调试状态；保留用户既有工作树改动。
- [x] 修正 AP 验收夹具的 typed array 与旧 `deal_round()` 调用，改用真实固定角色离线流程。
- [x] 以旧 AP 字段建立红灯，确认活动数据和实例化边界确实仍会暴露历史字段。
- [x] 删除活动 AP 数据与预算校验；旧客户端输入仅在边界丢弃，不参与战斗。
- [x] 回归故事首牌、转盘术式注册/战斗兼容和 Godot editor headless。
- [ ] 将 AI 逐张贪心选牌升级为先枚举最多三张合法组合、再按伤害/治疗/防御/状态/协同评分。

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

## 2026-09-18 - 核心优先级收敛

- [x] 真实窗口复核确认战斗策略覆盖层继承宿主背景；独立子场景截图不再作为产品页面缺陷证据。
- [x] 轮盘四个原生灰色入口（更多、返回、前盘、后盘）改为 `art/` 纹理 `TextureButton`，红灯/绿灯与轮盘自动评级回归通过。
- [x] 社区遮挡问题建立并通过局部排版验收；按用户优先级将社区标记为暂缓，不继续扩展。
- [ ] 运行四项核心流程验收：转盘生成角色、故事模式、转盘角色基础战斗、联机战斗。
- [x] 四项核心流程验收完成并写入 `reports/ui-audit/core-flow-audit-2026-09-18.md`：转盘、故事、转盘角色基础战斗、联机战斗均有独立新鲜证据。
- [x] 重新生成并读取 `reports/self-improve/self-improve-latest.json`、`reports/self-improve/self-improve-latest.md`、`reports/acceptance-latest.json`、`reports/full-flow/full-flow-latest.json`；自动验收 3/3、全流程通过，保留 6 个 P2 后续项。

## 2026-09-18 - 25 页运行时视觉审核继续

- [x] 读取 25 页捕获清单和既有 17 页审核报告。
- [x] 人工复核 11-15 页：角色库、社区主页、社区投票、社区讨论、战斗角色选择。
- [x] 记录社区页面遮挡/层级同质化/默认灰底，以及战斗选角标题乱码等 P1 证据。
- [ ] 继续复核 16-25 页，并为首个修复目标建立有效红灯验收。
- [x] 完成 16-25 页截图复核：记录战斗覆盖层默认灰底风险、召唤物占位/裁切、回合总结空灰底、联机原生下拉和预览服验收项。
- [ ] 读取战斗/轮盘场景代码，确认孤立截图与真实宿主流程的差异；随后为首个真实视觉缺陷建立红灯。

## 2026-09-18 - 基础战斗首回合可读性

- [x] 读取 V3 `round_package`、`actions[*].result`、`inputs` 和前后状态结构，确认旧格式化器丢失了敌方意图/伤害来源。
- [x] 新增红灯验收 `BattleIntentDamageReadabilityAcceptance.gd`，验证修改前确实缺少“对方意图”“伤害来源”。
- [x] `BattleFlowSession` 保存本回合提交牌名，`RoundHistoryFormatter` 兼容真实 V3 封包与旧事件结构；聚合多张牌的命中/未命中、action/card 来源、HP 伤害和护盾吸收，避免“未命中但造成伤害”的矛盾提示。
- [x] 回合纪要面板复用 `art/fight/回合纪要.png`，不新增普通 Button；真实窗口截图显示文本完整，手牌和底部操作区仍可见。
- [x] `BATTLE_INTENT_DAMAGE_READABILITY_ACCEPTANCE PASS`、`BATTLE_ROUND_SUMMARY_REAL_WINDOW_ACCEPTANCE PASS`、`BATTLE_POST_STRATEGY_INPUT_PASS`。
- [x] 真实战斗宿主召唤状态复核：`BATTLE_SUMMON_REAL_WINDOW_ACCEPTANCE PASS`，`FightIntro` 将 summon 写入带 `art/fight/召唤物.png` 的状态栏卡面，名称和 HP 正确渲染。
- [x] 更新逐页审核结论：独立 `preview_summoned.tscn` 的占位“召唤物名称”不再作为真实页面缺陷；后续只需补真实卡牌触发召唤的端到端旅程。

## 2026-09-18 - 联机弹窗与预览后端真实验收

- [x] 发现并定位联机服务器选择弹窗灰框：来自 `PopupPanel` 默认主题，而非项目纹理。
- [x] 使用 `art/onlineroom/房间页面/服务器选择.png` 九宫格面板替换默认灰框，并增加“选择联机服务器”标题。
- [x] 保留两项 `TextureButton` 服务器按钮及原有 `_select_server`、endpoint 切换、页面状态刷新逻辑；未新增普通 `Button`。
- [x] 真实窗口截图保存：`reports/ui-audit/screenshots/online-popup-real-open.png`、`online-popup-real.png`；验收 `ONLINE_POPUP_REAL_WINDOW_ACCEPTANCE PASS`。
- [x] 预览后端只读/一次性房间验收：根页面 200、健康 `battleAuthority=true`、HTTP 完整战斗 PASS、Node WebSocket 双端 PASS、Godot 远端同步 PASS、本地匹配回归 PASS。
- [x] 重新运行 `tools/self_improve_check.ps1`：自动验收 `3/3`，全流程 `passed`，P0=0、P1=0、保留 6 项 P2。
- [x] 以新手和熟练玩家双视角写入 `reports/ui-audit/core-flow-audit-2026-09-18.md`、`findings.md` 和联机弹窗设计文档。

## 2026-09-18 - 严格按钮与真实窗口视觉复核

- [x] 重新运行 `CharacterSelectionStrictVisualAcceptance.gd`，确认无原生灰色 Button、无目标乱码、动态角色行均有 art 纹理且文案几何合格。
- [x] 修复战斗角色选择页两个重复姓名层与选择按钮文案泄漏；按钮文字缩短为“选择我方/选择对方”，放到加号右侧可读区域。
- [x] 新增 `CharacterSelectionRealWindowAcceptance.gd`，使用非 headless OpenGL 窗口生成默认页与打开选择器页截图。
- [x] 真实截图：`reports/ui-audit/screenshots/character-selection-real-default.png`、`character-selection-real-picker.png`；动态选择器行数 84，验收 PASS。
- [x] 联机静态页、服务器弹窗纹理和真实窗口回归再次 PASS；预览服务范围未改变。
- [x] 重跑 `tools/self_improve_check.ps1` 并读取四份报告：acceptance 3/3、full flow passed、P0=0、P1=0、P2=6。
- [ ] 继续做 720p/1080p/超长屏与最长中英日韩文案矩阵；当前角色卡详情密度仍列为 P2。

## 2026-09-18 - 转盘方向文字与角色属性实值布局

- [x] 新增 `WheelDirectionLabelVisualAcceptance.gd`，先在真实窗口红灯复现非零停留旋转下左右标签上下颠倒。
- [x] 修复 `WheelSegments.calculate_label_rotation()` 的父旋转补偿；真实截图 `wheel-direction-real.png` 通过。
- [x] 新增 `CharacterStatValueVisualAcceptance.gd`，先复现内联“实值”与评级层重合，再验证玩家/对手各六项属性。
- [x] 将属性名与“实值：数值”拆成独立视觉行，限制评级和值行矩形在卡片内且不相交；截图 `character-selection-stat-value-real.png` 通过。
- [x] 回归 `CharacterSelectionStrictVisualAcceptance`、`CharacterSelectionRealWindowAcceptance`、`WheelTextureControlAcceptance`、`WheelAutoRankAcceptance`；editor parse 退出码 0。

## 2026-09-18 - 严格美术对齐红灯补强

- [x] 将角色实值验收扩展为实际矩形相交、父格包围、视觉中心、字号和文本溢出检查。
- [x] 红灯复现 `SSS` 标签在 `RichTextLabel` 布局后恢复旧高度的问题；增加延迟几何校正，评级恢复为 28px 并与实值最终在属性格内上下居中；22px 已由 `grade_too_small` 红灯拒绝。
- [x] 重新生成 `character-selection-stat-value-real.png`，人工复核无白边、无评级/实值重合、无越界。
- [x] 聚焦回归 6 项全部通过；完整自我改进报告刷新为 acceptance 3/3、full flow passed、P0=0、P1=0、P2=6。
# 2026-09-18 本地 Web 双页面联机验收

- 读取 `export_presets.cfg`，确认当前版本有 `PreviewWeb` Web 导出预设。
- 使用 Mono 编辑器尝试导出，Godot 返回官方限制：C#/.NET 不能导出 Web；未改项目配置。
- 改用标准 Godot 4.6.2 导出成功，产物位于 `reports/web-acceptance/20260918-205958/`，包含 `index.html`、`index.js`、`index.pck`、`index.wasm` 等。
- 下一步：用本地静态服务器承载该包，浏览器双页面只连接 `https://119.91.224.223/preview-room-api` 预览房间服务。

## 2026-09-19 手牌平衡性审计

- [x] 读取手牌/资源/结算规则、BattleFlowSession、ActionResolverV3、RoundResolverV3、CardAvailabilityService、牌池源数据。
- [x] 统计 cards.json：351张；zero static damage=217；atomicEffects=299；前置条件=35；动态值=14。
- [x] 确认 V3 当前只按牌张数限制出牌，_instance_card 删除 cost.ap/apCost，规则中的2 AP预算尚未落地。

## 2026-09-19 AP 清理与平衡基线纠偏

- [x] 根据用户确认，将 AP 定性为历史残留，不恢复为战斗资源。
- [x] 清理卡牌、运行时模板、手牌注入和规则文件中的 AP 字段/显示标记。
- [x] 移除 BattleFlowSession 的 AP 预算校验与 AP 合法性函数；保留旧输入字段在实例化边界被丢弃的兼容行为。
- [x] 新增 `tests/ap_cleanup_acceptance.mjs`，先红后绿验证数据与活动流程均不再依赖 AP。
- [ ] 下一步：建立固定种子真实战斗测量，统计 CE 瓶颈、三牌组合有效率、有效伤害和防御/治疗/状态价值。

## 2026-09-19 固定种子平衡测量完成

- [x] 新增并运行 `tests/godot/HandBalanceMeasurement.gd`，20 个固定种子走真实发牌、弃牌、先手、V3 预演和真实结算。
- [x] 普通角色基线：虎杖涩谷 vs 七海涩谷；8 张弃牌后手牌全部可单出，三牌组合有效率 100%，正常 CE 拒绝率 0%，有效 HP 伤害均值 32.02。
- [x] 低/正常/高 CE 观察：25% CE 时约 7/8 可行动，60% 与 100% CE 均 8/8；CE 目前不是正常首回合瓶颈。
- [x] 领域场景：宿傩新宿 vs 七海；领域每局出现且可预演，但单独即时伤害为 0，后续需测激活后两回合窗口。
- [x] 新增 `tools/build_card_balance_inventory.mjs`，对 351 张卡分为十类并输出每类 5 张基准牌和预算初盘。
- [x] 报告：`reports/balance/balance-findings-2026-09-19.md`、`reports/balance/card-balance-inventory-2026-09-19.md`。
- [ ] 下一步：对基准牌做同 CE 配对的两回合 TTK/防御收益/状态兑现/领域窗口测量，再决定少量数值调整。
- [x] 确认卡面 CE 与 DSL costCe 覆盖可能不一致（苍20/30、赫50/60）。
- [x] 运行 STORY_BATTLE_FIRST_CARD_ACCEPTANCE：PASS。
- [x] 查阅公开费用曲线、卡差/节奏、协同复杂度和加算/乘算资料。
- [x] 保存 `reports/balance-audit-2026-09-19.md`；等待用户确认 A/B/C 方案后再修改生产数值。

## 2026-09-19 卡牌价值配对场景

- [x] 新增 `tests/godot/CardValueScenarioBenchmark.gd`，用真实 BattleFlowSession 测量防御、治疗、状态、术式和领域窗口。
- [x] 防御配对记录实际避免 HP 伤害；治疗配对记录受伤后净恢复并加入空过对照；状态配对读取我方承伤差值。
- [x] 术式赫与基础攻击完成同种角色/对手的 CE 与伤害对照；领域记录激活回合、第二回合伤害、CE 和负荷。
- [x] 报告写入 `reports/balance/card-value-scenarios-2026-09-19.md`，明确缺失样本不能解释为 0 价值。
- [ ] 扩大场景种子与专门牌池，补足治疗、状态和术式准备样本后，再提出第一轮基准牌数值修改。

## 2026-09-19 全术式审计统合

- [x] 按三层粒度建立设计和实施计划：术式家族、术式链、单张术式牌。
- [x] 新增 `tools/build_technique_audit_inventory.mjs` 与 `tests/technique_audit_inventory.mjs`；旧基线覆盖 351 张牌、84 个角色、12 个手写家族，随后已扩展为完整 source profile 目录。
- [x] 新增真实 Godot 夹具 `tests/godot/TechniqueAuditMeasurement.gd`，调用 `BattleFlowSession`、牌池服务和 V3 真实结算；每个样本记录 CE 档位、限制检查、命中、特殊效果 after-state、召唤和领域状态。
- [x] 全量运行 88 张可匹配术式牌，输出 783 条固定种子/CE 档位样本；64 张牌有成功运行时样本，1 张明确无可用角色样本，其余失败/不可达原因保留在报告中。
- [x] 新增 `tools/build_technique_audit_report.mjs` 与 `tests/technique_audit_report.mjs`；报告同时覆盖全 351 张牌、12 个家族和全部缺失样本。
- [x] 生成 `reports/balance/technique-audit-2026-09-19.{json,md}` 与 `reports/balance/technique-adjustment-proposals-2026-09-19.md`。
- [x] 回归：`TECHNIQUE_AUDIT_MEASUREMENT PASS rows=783 failures=0`、`TECHNIQUE_AUDIT_REPORT_TEST PASS`、AP 清理 Node/Godot 验收均 PASS。
- [ ] 对报告中确认的 P1/P2 平衡问题做少量单变量复测；运行时未生效/缺失样本先修复可达性，不直接改数值。

## 2026-09-19 术式族牌组评分系统

- [x] 写入评分设计 `docs/superpowers/specs/2026-09-19-technique-family-scoring-design.md`。
- [x] 新增 `tools/score_technique_families.mjs`：读取术式族实际牌组成、DSL 原子效果、真实测量 after-state 和限制失败原因，输出综合/攻击/防御/续航/难度/可靠性。
- [x] 新增 `tests/technique_family_scoring.mjs`，确认完整 canonical family 评分和所有分数在 0-100。
- [x] 修正 `target_not_dealt` 与 `domain_not_available` 的可达性区分；旧 12 族烟雾验收已被完整目录回归覆盖。
- [x] 生成 `reports/balance/technique-family-strength-2026-09-19.json` 和 `.md`；本轮未修改生产牌值。
- [x] 启动后台全量流程 `tools/run_technique_family_strength.ps1`（PID 21228），流程为全术式牌真实 Godot 测量完成后自动评分；本轮不轮询进程。

## 2026-09-19 转盘全术式注册修复

- [x] 确认旧注册表的 12 项只是手写 canonical family，不是完整术式目录；source profile 共 72 项，实际“生得术式”转盘有 65 个选项。
- [x] `WheelTechniqueRegistry` 改为从 `strength-v0.2-candidate.json` 解析完整 profile，保留旧领域/强度覆盖，并返回 source profile、别名和特殊手牌标签。
- [x] 修复展示名（例如“无为转变 —— 真人”）到角色快照的桥接，快照现在保留真实标签、领域和牌池匹配数据。
- [x] 新增 `WheelTechniqueFullRegistrationAcceptance.gd`、`WheelTechniqueWheelItemAcceptance.gd`；72/72 profile、65/65 转盘选项和 battle compatibility 均通过。
- [x] 审计索引不再正则读取旧 12 项常量；覆盖 351 张牌、84 个角色、72 个 source profile，合并别名后输出 70 个 canonical family。
- [x] 重新生成 `reports/balance/technique-audit-inventory-2026-09-19.json`、`reports/balance/technique-family-strength-2026-09-19.{json,md}`；每个族保留分类和 sourceProfiles，空族键污染已修复。

## 2026-09-20 DeepSeek 上下文边界验收

- [x] 新增 `tests/backend/ai_context_acceptance.mjs`：mock fetch 捕获 DeepSeek 请求体，验证当前节点、NPC 角色卡、权威关系状态和最近对话上下文。
- [x] 验证 `recentTurns` 最多为最近 6 轮；未来节点、未命中的世界条目和完整故事包哨兵不会发送给模型。
- [x] 新增 `npm --prefix backend run test:ai-context`；上下文验收、AI 对话验收和两个后端模块 `node --check` 均通过。

## 2026-09-20 Web 故事、AI 与编辑器第二轮

- [x] AI 节点/NPC 服务端绑定，阻止客户端通过 context 读取未来节点或其他角色卡。
- [x] 按 effect policy 和 maxTurns 执行每回合/每会话成长、关系、记忆与软旗标上限。
- [x] 按内容分类选择本地回退文本；初级术师覆盖问候、追问、拒绝、友好、敌对、结束、接口不可用和无法理解。
- [x] 故事运行时支持 `rpgLines`、显式时段选择、行动 outcome、条件权重结果及资源/成长/关系/物品/旗标。
- [x] AI session 和 V3 battle session 随故事快照恢复；存档提交串行化并处理 revision 冲突。
- [x] 故事战斗接入现有 V3 resolver 和真实牌库，完成准备、弃牌、先手、最多三张出牌、结算和返回故事。
- [x] 工作台增加连续台词编辑、预览、上下游引用、撤销重做、本地草稿和服务端共用完整校验。
- [x] 真实 `deepseek-flash` 模型列表探测和对话回合通过，未输出或持久化 Key。
- [x] 全量 Web/后端回归 10 组全部通过；`git diff --check` 无空白错误。
- [ ] Web 转盘、独立基础战斗页和联机大厅仍是明确占位模块。
- [ ] 工作台缺少节点图画布、审核者身份、不可变发布/归档/回滚版本库和多人冲突处理。
- [ ] 补旧存档/旧故事正式迁移器、AI 质量固定评测、移动端与多分辨率真实窗口验收。

## 2026-09-20 Web 转盘运行时与入口

- [x] 移植 `WheelFlowSession.gd` 的纯数据职责到 `web-runtime/wheel-runtime.mjs`。
- [x] 通过只读 `/api/wheel/config` 提供 72 个 flow 节点、157 个 wheel 和效果规则。
- [x] Web 转盘支持固定 seed、条件跳过、加权抽取、多抽取、时间线事件、效果账本和等级计算。
- [x] 转盘结果可写入存档快照，完成后可进入故事或基础战斗。
- [x] 固定 seed、内容 API 和真实浏览器完整流程均通过。
- [ ] 仍需将转盘角色快照与独立基础战斗/联机角色锁定协议正式连接。
