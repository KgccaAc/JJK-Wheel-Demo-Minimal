# CODEX_HANDOFF

## Project Goal
- 保持本地与官方服务器各自的权威状态机，完成 Web 兼容的双端在线战斗：匹配/房间、角色锁定、策略、弃牌、先手、出牌、胜负和结算全程同步。

## Current Phase
- Phase: 第一章攻略型NPC垂直切片
- Status: NPC数据、关系状态、路线阶段、第一章时间行动、真实战斗援护和统一结算展示已接通。

## Latest Completed Work
- 文件1节点交互链补强：`StoryState.node_contract()` 为 JSON 节点生成统一运行时契约，区分手动、隐式转盘、四时段、本地战斗、地图、结算和终止节点；`begin_node()` 拒绝未知节点、待结算重复进入和终止存档继续推进。
- 节点契约验收补充了实际 `StoryState` 运行时检查：开局 RPG 默认手动、普通选择解析为四时段本地逻辑、战斗解析为真实战斗；文件1 56 个节点的链接和场景路径均无悬空项。
- 故事战斗失败处理补齐：真实战斗角色生命归零时写入 `protagonist_dead` 与 `run_terminal`，统一结算后地图进入终止态；新增 `Chapter1BattleTerminalAcceptance.gd`。
- 咒具商人普通事件补齐物品链：随机结果获得 `river_protective_talisman`，`StoryState` 持久化库存，`StoryBattleAdapter` 将护符投影为真实支援牌；新增 `Chapter1MerchantItemAcceptance.gd`。
- 统一结算页现在显示 `inventory_delta`，商人获得的护符会和资源/成长变化一起呈现给玩家。
- 地图右侧角色状态面板新增库存摘要，护符等普通节点物品在回到主线地图后仍可见。
- 地图和结算页将物品 ID 转为玩家可读名称；地图状态面板同时显示攻略型 NPC 初级术师的路线阶段和援护解锁状态。
- `StoryState` 启动时新增文件1数据校验：检查节点场景、核心 AI 禁用、普通选项链接以及资源/成长字段，结果写入 `chapter_validation` 并随快照保存。
- 文件1运行时校验继续覆盖隐式转盘权重、四时段四行动结果完整性和地图节点/前置条件；当前 6 个地图节点全部通过配置检查。
- AI 接口改为 `StoryState.set_story_ai_provider()` / `get_story_ai_provider()` 可注入边界；Selection 默认仍使用不可用 provider 并回退本地逻辑，未来接入远程 AI 无需改页面状态机。
- 核心战斗桥（8 个涩谷战斗节点）及 `core_shibuya_end` 已显式声明 `aiMayResolve:false`，核心 AI 禁用检查现在全量通过。
- RPG 选项和地图进入按钮增加转场期间幂等锁，避免重复点击造成重复结算或重复跳转；新增 `Chapter1NodeContractAcceptance.gd` 覆盖 8 类节点、关键节点禁用 AI 和 16 个普通行动结果。
- 官方 `/opt/jjk-preview-room` 已更新 `preview-room-server.mjs`、`battle-v3-resolver.mjs`、`online-room-socket.mjs`，健康检查返回 `battleAuthority: true`。
- 官方 Nginx 已启用 WebSocket Upgrade/Connection 头和 75 秒读取超时，并保留回滚配置。
- 官方 CORS allow-list 支持 `https://119.91.224.223`；预检返回 204 和按 Origin 回显的 allow-origin，未使用 `*`。
- 服务器胜负字段由权威 resolver 计算并广播；结束态包含 `winner` 与 `finish_reason`。
- Godot `RemoteOnlineRoomSocket` 只有 `send_packet` 成功后才清除待发送订阅，修复首次 OPEN 竞态导致的无广播连接。
- 新增 `data/story/npcs.json`：剧情向、情报向、攻略型、商人和敌对NPC数据；初级术师具备临时伙伴/正式招募路线。
- `StoryState` 现在保存NPC关系、路线阶段、NPC旗标和随行状态；`resolve_local`支持关系与NPC旗标在统一结算时提交。
- 第一章交谈/搜索时间行动会记录初级术师的好感、信任、认可和个人事件旗标；RPG河岸选择也会影响关系。
- `StoryBattleAdapter` 会在初级术师成为伙伴后，把零CE的“援护·护住盲区”作为保证每回合出现的支援牌注入角色完整快照；卡牌仍经过 `LoginCardCharacterProjector`、真实发牌与 V3 规则结算。
- 修复 V3 每次行动重算派生数值时错误清空 `guard` 的问题；援护牌现在能在对手行动前后保留40点护盾。
- 战斗角色侧栏显示随行伙伴和援护规则；节点结算的“人物关系”区域显示关系增减、路线阶段和正式伙伴状态，战后胜负继续影响好感/信任/认可。
- RPG 通用框架现在读取核心节点的 `rpgLines/choices`；W145「是否加入高专」会写入 `core_results`，保留 wheelId=145 和玩家手动选项，跳过与 AI 代选均被拒绝。
- W145 结算后地图会显示下一原剧情盘节点；尚未制作的 W171/W172 等核心节点进入时明确提示“已预留”，不会重复打开 W145。
- W171「高专在哪个校」和 W172「高专地位」已从 `data/wheels.json` 读取真实选项：RPG框架会动态生成3项/4项按钮，分别保存 wheelId=171/172；学生选项进入 W36 预留节点，其他身份进入 W170 预留节点。
- 文件1中的随机、分支、高危节点已经接通：随机节点使用本地权重隐式转盘，分支节点使用手动选项，高危节点复用真实战斗并按实际节点结算。
- 第一章旁线链路为 `chapter1_clue → chapter1_optional_event → chapter1_branch → chapter1_danger`，每一步都会进入统一 settlement 并由地图按历史解锁。
- 普通隐式转盘使用每局保存的 `run_seed`、历史长度和当前资源参与本地抽取；同一存档可复现，重新开始会获得新的局内结果。
- 隐式转盘结果会写入局内剧情旗标，并据此生成下一分支的可用操作：目击者、咒具商人、初级术师安全标记分别解锁专属行动，同时始终保留“稳妥撤离”。
- 第一章完成入口接受普通战斗或高危战斗任一路线，修复高危旁线战后地图仍锁住核心剧情入口的问题。
- W96/W97、W143、W132、W149、W148 已按原始轮盘选项接入核心 RPG；高专路线可从“成功拯救顺平”推进到涩谷开场与行动影响节点，非高专路线进入 W98 预留节点。
- W150/W151/W152/W153/W98/W69 已完成结果层 RPG；W69 的重伤、存活、牺牲会通过核心选择结算资源、经验、稳定值和旗标，涩谷阶段最终进入 `core_shibuya_end`。
- 文件2中原始选项明确写有“对战”的分支已增加核心战斗桥：RPG 手动选择先提交原始轮盘结果，再进入 `core_battle_*`，复用真实 V3 战斗与转盘角色术式/标签/发牌链，战后按节点 `next` 回到 W150/W152/W69 等原时间线节点。
- 核心选择现在也能提交 `storyFlags`。W93“重伤”会真实封锁 W143 的“参加涩谷”选项；W69“重伤存活/牺牲”会写入死灭回游禁入或角色死亡旗标，供后续时期直接判断。
- 文件2的三个收敛节点已落地：`core_shibuya_gojo_state_bridge`、`core_shibuya_kenjaku_plan_state`、`core_shibuya_worldline_state`。选项严格对应源时间线中的3/4/4项，并通过旗标影响宿傩线、死灭回游和后续世界线。
- 文件2的 `shibuyaOutcome` 加权结局节点已落地为 `core_shibuya_outcome`：高专胜利、咒灵胜利、诅咒师胜利三项按源文件等权重由局内种子抽取，结果写入 `shibuya_outcome` 并统一进入 `core_shibuya_end`。
- 加权结局已按源文件“参与时按所在阵营提高对应胜利项权重”补上 `weightByFlag`：高专、羂索方、第三方分别提高对应结局权重，仍保留本地可复现抽取。
- 涩谷结局后已接入文件2 `cullingGame`：`core_culling_gate` 判断死灭回游能否发生；不可发生时进入源文件三项改写走向，可发生时进入 W144，并按角色条件分流到 W54/W70、W107 或 W55，最终进入 W127/W72 结果节点。

## Important Modified Files
- `backend/battle-v3-resolver.mjs`
- `backend/preview-room-server.mjs`
- `backend/online-room-socket.mjs`
- `battle/online/RemoteOnlineRoomSocket.gd`
- `tests/backend/official_online_battle_full_acceptance.mjs`
- `tests/backend/official_online_battle_websocket_acceptance.mjs`
- `tests/godot/OnlineBattleFullSyncAcceptance.gd`
- `tests/powershell/online_battle_full_acceptance.ps1`
- `data/story/npcs.json`
- `tests/godot/NpcCompanionStateAcceptance.gd`
- `story/StoryBattleAdapter.gd`
- `scenes/battle/FightPresenter.gd`
- `battle/core/BattleFlowSession.gd`
- `battle/v3/ActionResolverV3.gd`
- `account/LoginCardCharacterProjector.gd`
- `scenes/story/SettlementFlow.gd`
- `tests/godot/CompanionBattleAcceptance.gd`
- `tests/godot/CoreRpgAcceptance.gd`
- `tests/godot/CoreMapAcceptance.gd`
- `tests/godot/CoreMultiChoiceAcceptance.gd`
- `tests/godot/Chapter1NodeTypesAcceptance.gd`
- `tests/godot/Chapter1MapRouteAcceptance.gd`
- `tests/godot/Chapter1GraphAcceptance.gd`
- `tests/godot/CoreBattleBridgeAcceptance.gd`
- `tests/godot/CoreConsequenceAcceptance.gd`
- `tests/godot/CullingEntryAcceptance.gd`
- `tests/godot/CullingSpecialRoutesAcceptance.gd`
- `tests/godot/CullingTengenAcceptance.gd`
- `tests/godot/CullingDeadEndAcceptance.gd`
- `tests/godot/TerminalMapAcceptance.gd`
- `tests/godot/StoryFlowAcceptance.gd`（新增文件1/文件2运行时一致性检查）
- `tests/godot/Chapter1DataDrivenAcceptance.gd`
- `tests/godot/StoryAiFallbackAcceptance.gd`
- `tests/godot/ShibuyaOutcomeAcceptance.gd`（已扩展收敛节点路径）
- `tests/godot/ShibuyaCoreAcceptance.gd`
- `tests/godot/ShibuyaOutcomeAcceptance.gd`
- `scenes/story/RpgFlow.gd`
- `scenes/story/MapFlow.gd`
- `data/story/chapter1.json`
- `story/StoryState.gd`

## Verification
- 官方原生 WebSocket 双端完整战斗 PASS，FINISHED 且双方 winner 一致。
- 官方 HTTP 完整战斗 PASS。
- Godot 双端 WebSocket 全阶段同步 PASS，revision 与 winner 一致。
- 本地权威服务完整战斗 PASS。
- 官方 OPTIONS 预检 204，allow-origin 按请求 Origin 返回；`/health` 正常。
- 三份故事JSON解析通过；Godot editor parse 为0错误。
- `NPC_COMPANION_STATE_ACCEPTANCE PASS stage=recruit companion=true affection=61`。
- `COMPANION_BATTLE_ACCEPTANCE PASS injected=true dealt=true guard=40.0`。
- `CORE_RPG_ACCEPTANCE PASS loaded=true wheel=145 value=是 next=core_high_school_campus`。
- `CORE_MAP_ACCEPTANCE PASS node=core_high_school_campus title=当前节点：W171·高专在哪个校`。
- `CORE_MULTI_CHOICE_ACCEPTANCE PASS campus=true first=true status=true second=true`。
- `CHAPTER1_NODE_TYPES_ACCEPTANCE PASS random=true branch=true danger=true current=chapter1_danger`。
- `CHAPTER1_MAP_ROUTE_ACCEPTANCE PASS normal=true danger=true`。
- `CHAPTER1_GRAPH_ACCEPTANCE PASS nodes=38 types=8 errors=`。
- `CORE_BATTLE_BRIDGE_ACCEPTANCE PASS configured=true entered=true committed=true current=core_battle_shibuya_sukuna`。
- `CORE_CONSEQUENCE_ACCEPTANCE PASS severe=true gate=true injury=true`。
- `CHAPTER1_GRAPH_ACCEPTANCE PASS nodes=41 types=8 errors=`。
- `CHAPTER1_GRAPH_ACCEPTANCE PASS nodes=42 types=8 errors=`。
- `SHIBUYA_OUTCOME_ACCEPTANCE PASS high=true non_high=true`（包含加权结局）。
- `CULLING_ENTRY_ACCEPTANCE PASS allowed=true joined=true routed=true located=true result=true altered=true`。
- `CULLING_SPECIAL_ROUTES_ACCEPTANCE PASS weak_reincarnation=true special=true`。
- `CULLING_TENGEN_ACCEPTANCE PASS join=true gate=true guard=true result=true`。
- `CULLING_DEAD_END_ACCEPTANCE PASS gate_option=true dead_option=true next=core_culling_dead_end`。
- `TERMINAL_MAP_ACCEPTANCE PASS current=chapter1_end subtitle=本次运行已终止；可以查看历史或返回首页。`。
- `STORY_FLOW_ACCEPTANCE PASS`，其中 `runtime core timeline matches chapter nodes checked=29 errors=`。
- `CHAPTER1_DATA_DRIVEN_ACCEPTANCE PASS intro=true clue_choices=true result=true`。
- `CHAPTER1_STATIC_CHECK PASS nodes=56 selection_outcomes=16 errors=`；文件1所有节点均有场景路径，普通节点16个时段结果均有文本。
- `CHAPTER1_SCENE_PATHS PASS missing=`；文件1节点场景资源路径全部存在。
- `CHAPTER1_LINK_CHECK PASS`；文件1节点、选项、战斗桥和地图前置条件无悬空链接。
- `STORY_AI_FALLBACK_ACCEPTANCE PASS fallback=true input_visible=true`。
- `SHIBUYA_CORE_ACCEPTANCE PASS W96=true W143=true W132=true W149=true W148=true current=core_shibuya_seal_failure`。
- `SHIBUYA_OUTCOME_ACCEPTANCE PASS high=true non_high=true current=core_shibuya_end`。
- `CORE_MAIN_START_ACCEPTANCE PASS W36=true W170=true W93=true W95=true current=core_junpei_high_school`。
- StoryInteraction、StoryBattleCharacter、BattlePostStrategyInput 回归通过；真实窗口生成8张故事流程截图，战斗和结算画面已人工检查。

## Known Risks / Untested Areas
- 尚未在真实浏览器导出包中做双标签页操作验收；Godot WebSocketPeer 与 Node WebSocket 已通过。
- 当前战斗用“固定入手的支援牌+角色侧栏徽记”表达伙伴援护，尚未制作独立伙伴立绘、入场动画和语音演出。
- 第一章自然关系增量只会推进到初识/试探阶段，正式招募预留给后续个人事件；验收通过测试状态直接解锁伙伴验证战斗链路。
- battle子场景仍有6条旧 invalid UID 元数据警告，会回退到文本路径并成功加载；未发现本轮新增解析错误。
- 本轮已将文件1开局与线索剧情节点改为 `chapter1.json` 数据驱动，RPG运行时统一读取 `rpgLines`、`choices`、资源/成长/关系变化并写入统一结算；旧常量仅保留兼容回退。
- Selection 的 AI 模式已接入 `StoryAiProvider` 预留接口：故事设置页允许玩家选择 AI 普通节点模式，玩家可输入自定义行动；provider 不可用或返回非法结果时自动回退本地四时段逻辑，核心节点仍不走 AI。
- `CoreBattleBridgeAcceptance` 与 `ShibuyaOutcomeAcceptance` 在无界面测试退出时仍报告1个场景资源未释放；测试退出码为0，运行链和编辑器解析正常，后续可单独清理测试场景生命周期。
- W145、W171/W172、W36、W93、W95、W96/W97、W143、W132、W149、W148、W150、W151、W152、W153、W98、W69以及三个涩谷收敛节点和文件1普通旁线均已具备可玩的逻辑；涩谷明确对战分支进入真实战斗桥，非战斗分支使用有限核心选择。
- 若最终 Web 页面部署到不同 Origin，需要把该 Origin 显式加入 `PREVIEW_ROOM_ALLOWED_ORIGIN`，不能改成通配符。
- 文件2死灭回游节点已覆盖 W73、W74、W54、W70、W107、W127、W72；W145 的加入高专结果会写入 `joined_high_school`，高专路线先经过天元守卫链，非高专路线直接进入 W144。分流依据来自角色术式与等级标签，结果仍由玩家手动确认。
- 文件2已扩展为三段时间线：`mainStart`、`shibuya`、`cullingGame`；死灭回游的 W73/W74/W144/W54/W70/W107/W55/W127/W72 已正式列入源清单，运行时一致性校验覆盖29个节点。
- 文件1节点入口已统一由 `StoryState.scene_for_node()` 按节点类型/声明场景解析，StoryHome 与 Map 不再维护 ID 白名单；结算页已修正关系与路线渲染调用，资源、成长、物品、NPC关系和下一节点均在同一结算流程展示。
- W73/W74 已实际接入 `core_culling_gate`：加入高专的角色显示守卫天元入口，非高专角色保留直接进入 W144 的路径；守卫结果会写入经验、稳定值和 `tengen_guard_result`。
- 新增 `core_culling_dead_end`，角色死亡旗标出现时强制进入可结算的终止节点，避免死角色停在无可用选项的核心页面。
- `MapFlow` 识别 `run_terminal`，终止存档只显示历史/返回首页提示，不再允许从地图重新进入核心节点。
- `CHAPTER1_SCENE_ROUTER_ACCEPTANCE PASS` 覆盖文件1全部56个节点的场景路由与资源存在性。
- `STORY_AI_MODE_SELECTION_ACCEPTANCE PASS` 验证故事设置选择 AI 后 Selection 读取模式并在 provider 不可用时回退本地结果。
- `STORY_HOME_AI_MODE_ACCEPTANCE PASS` 验证故事设置开始按钮不会覆盖玩家选择的 AI 普通节点模式。
- `STORY_AI_SANITIZATION_ACCEPTANCE PASS` 验证 AI 响应只能写入白名单资源/成长和叙事文本，越权跳转、旗标、物品与非法数值会被清洗。
- `CORE_BATTLE_PROFILES_ACCEPTANCE PASS` 逐个启动文件1中8个核心战斗节点，确认 battleProfile、真实战斗会话、角色投影和发牌状态均可用。
- 核心战斗的 `battleProfile -> opponent_id` 映射已移入 `StoryBattleAdapter`，FightPresenter 与全量验收共用同一适配器，避免节点数据与实际敌方不一致。
- 新增 `StoryState.battle_context()` 作为统一战斗运行时契约，集中提供节点、profile、敌方角色、来源轮盘、战后回归节点和 AI 禁用状态；FightPresenter 已改用该契约。
- `STORY_BATTLE_CONTEXT_ACCEPTANCE PASS` 覆盖文件1全部10个战斗节点。
- 文件1战斗节点新增 `battleRules`，战斗结果由 `StoryState.battle_result_rules()` 按节点读取，核心敌人可以拥有不同的经验、稳定值和成长收益；FightPresenter 不再写死统一奖励。
- `STORY_BATTLE_RULES_ACCEPTANCE PASS` 验证宿傩胜利/撤退规则和 HP/CE 损耗计算。
- `CHAPTER1_BATTLE_RULES_VALIDATION_ACCEPTANCE PASS` 验证所有战斗节点的 battleRules outcome、资源键和成长键。
- `CHAPTER1_BATTLE_CONTRACT_ACCEPTANCE PASS` 验证10个战斗节点的运行时契约均暴露 victory/retreat/defeat 三类结果规则。
- 第一章分支新增攻略型 NPC 正式招募事件：安全标记、经历值达到条件后出现“回应术师的承诺”，结算时写入个人事件旗标并解锁伙伴援护。
- `CHAPTER1_COMPANION_ROUTE_ACCEPTANCE PASS` 验证隐藏选项可见、关系结算和 recruit/companion 状态。
- `StoryState` 启动时读取 `core-timeline-main-start-shibuya.json`，核对文件1中20个主线/涩谷节点的映射、轮盘编号、顺序和 AI 禁用策略；一致性失败会进入验收失败。

## Next Safest Task
- 补齐涩谷结果节点对应的真实战斗表现、伤势对后续死灭回游的条件影响；再接入普通节点的AI可选接口与商人库存，并制作初级术师第2章个人事件。

## 2026-09-17 内容包更新
- 新增 `data/story/chapter1_background_plan.json`：第一章20个背景位的分类、路径、节点用途、现有/待制作状态和美术 brief。
- 新增 `docs/story/chapter1-content-design.md`：第一章故事节拍、Galgame式攻略型 NPC 关系设计、NPC 分工、对话分配、AI 边界和结算/小说规则。
- 扩展 `data/story/npc_dialogue.json`：河岸目击者和咒具商人的可运行对白与交互选项；初级术师专属事件与正式招募路线保持不变。
- 新增 `tests/godot/Chapter1ContentPackageAcceptance.gd`：通过 StoryState 验证背景清单、设计书、三条 NPC 路线、运行时对白和双报告。
- 验收：`CHAPTER1_CONTENT_PACKAGE_ACCEPTANCE PASS backgrounds=20 routes=3 design=true runtime_dialogue=true reports=true`；`FULL_STORY_RUN_ACCEPTANCE PASS visited=32 history=32 battles=2 scenes=true current=chapter1_end`。

## 2026-09-17 故事模式 UI/战斗边界修复

- StoryHome 导航、角色选择和章节卡状态已接通；Identity 字段、评级印章、剪影和编辑布局已补齐。
- RPG 点击推进、选择层级、战斗选项和 Speaker 居中已修复；Selection 结果会先展示再推进时间。
- Settlement Review 承载双报告/小说，Map 完成节点有灰色蒙层；音乐结束自动循环。
- BattleFlowCoordinator/FightPresenter 对 room、identity、visible_state、data、actors、zones、hand 等边界数据做安全转换，异常响应不再触发 Dictionary cast 崩溃。
- 验证通过：`SETTLEMENT_REPORTS_UI_ACCEPTANCE PASS reports=true history=true`、`STORY_UI_CONTRACT_ACCEPTANCE PASS`、`BATTLE_BOUNDARY_CAST_ACCEPTANCE PASS response=true`、`STORY_INTERACTION_ACCEPTANCE PASS`、`FULL_STORY_RUN_ACCEPTANCE PASS visited=32 history=32 battles=2 scenes=true current=chapter1_end`。
- 编辑器 headless 解析通过；仍有项目原有 invalid UID 警告，Godot 回退文本路径加载且不影响功能验收。

## 2026-09-17 全页面按钮与路由审计

## 2026-09-18 运行时临时 UI 清理

- 移除故事/战斗页面中由脚本临时创建的提示牌、确认按钮、伙伴徽章、对手牌面叠字、结算继续按钮和身份页动态 MetaGrid/姓名编辑器。
- 保留 `.tscn` 已制作的标题、正文、卡牌字段、身份卡字段与按钮；先手投入恢复为既有投入按钮的第一次选中、第二次确认。
- 对手行动牌改为不可交互的 `TextureRect`，不再创建伪按钮；终局结算通过战斗页已有 ExitButton 继续既有结束流程。
- 同步清理旧 `scenes/fight` 入口的先手伪确认按钮和对手牌面叠字，避免联机旧入口出现不同表现。
- 验证：目标故事/战斗/身份脚本运行时控件静态扫描 `RUNTIME_UI_SCAN=PASS`；Godot editor headless 解析 `EDITOR_EXIT=0`。完整运行验收受当前环境无法创建 Godot 用户目录影响，未声称通过。

- 新增 `tests/godot/PageButtonWiringAudit.gd`，覆盖登录、首页、转盘、角色认定、模式选择、六个故事页面、角色库、社区、战斗角色选择、战斗、联机和用户页。
- 运行结果：`PAGE_BUTTON_WIRING_AUDIT PASS pages=17 buttons=371 load_errors=0 unbound=0`；当前可用按钮 157 个，焦点缺失 0，无文字且无提示 0。
- 修复 `scenes/battle/character_selection.tscn` 资源语法损坏及非法 BBCode；`CharacterSelection.gd` 运行时正确投影六项属性名称。
- `reports/ui-audit/navigation-targets-latest.json` 显示 196 个场景引用全部存在。
- 逐页结论与剩余改进见 `docs/ui-page-logic-audit.md`。当前 P2 包括 invalid UID、重复旧场景、三分辨率截图、Web/CORS 全旅程、核心按钮专属状态图和条件按钮语义点击矩阵。

## 2026-09-17 故事呈现与操作反馈补强

- 新增 `StoryPresentationAuditAcceptance.gd`，以真实场景实例检查结算长文本、章节完成 CTA、战斗双击确认、角色元信息栅格、四时段行动反馈与 RPG 继续提示。
- Settlement 的事件回顾改为固定范围的滚动正文；长经历保留在“完整回顾”入口，避免被底部按钮区域遮挡。
- Map 第一章完成态显示结局摘要与 `查看第一章结局` CTA；不再把已完成章节表述为“当前小样在此结束”。
- StrategySelection 显示“选择 1 项”与两次点击确认状态；Identity 将性别、年龄、时间线、阵营改为两列元信息，长值可截断并通过提示查看。
- Selection 显示当前行动及结算资源/成长变化，并在四张行动卡增加倾向脚注；RPG 将继续提示替换为带深色底板的高对比、非拦截式 `点击对话框继续`。
- BottomNav 现在在当前选中图标上方显示页面名称；战斗倾向在预览后通过明确的“确认倾向”按钮进入下一步。
- 验证：`STORY_PRESENTATION_AUDIT_ACCEPTANCE PASS failures=[]`，`PAGE_BUTTON_WIRING_AUDIT PASS pages=17 buttons=371 load_errors=0 unbound=0`，`FULL_STORY_RUN_ACCEPTANCE PASS visited=32 history=32 battles=2 scenes=true current=chapter1_end`，真实窗口流程 11 张截图 `PASS`。

## 2026-09-17 第一章真实流程与独立复核

- 已运行真实窗口流程并记录在 `reports/full-flow/full-flow-audit-record.md`：Identity → Select → StoryHome → RPG → Selection×4 → Settlement → Map → RPG → Battle → Settlement → Map。
- 结果：11 张截图、失败项 0；证据在 `reports/full-flow/full-flow-latest.json` 与 `reports/full-flow/screenshots/`。
- 独立子 agent 审计见 `reports/full-flow/subagent-audit.md`。没有复现 P0 卡死，但发现四项 P1：真实玩家输入尚未覆盖完整战斗回合；首次结算长回顾可被底部区域遮挡；章节完成态 CTA 语义冲突；战斗首屏阶段/确认反馈不足。
- 下一轮先扩展 `StoryRealWindowFlowAcceptance.gd`，用玩家输入完成战斗倾向、发牌、出牌和回合结算；随后修复 Settlement 溢出与章节完成 CTA。
