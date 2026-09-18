# 发现

- 目标页面的美术底图和组件大多已经完整，粗糙感主要来自静态样例数据、无状态按钮、页面各自跳转和结算不闭环；因此本轮保留美术主体，重做流程、数据绑定、交互反馈与验收。
- 转盘输出的 `wheel_rank` 已包含 grade、answers 和六维 stats，可直接作为 identity、Select、StroyHome、Map 与 battle 的同一角色快照来源。
- RPG 初始背景资源完整存在于 `art/Story/RPG/初始背景/1.png` 至 `6.png`；原项目没有专用玻璃破碎音，因此新增 `assets/audio/story/glass_shatter.wav`。
- Selection 原 AI 输入面板会覆盖底部四张行动卡；基础模式隐藏输入面板后，四张卡完整可见。普通节点适合在节点内累计四个时段，晚上统一结算。
- Settlement 原底部窄标签被写入多行摘要导致越界；资源与成长已有专用区域，因此底栏仅保留保存状态，路线区动态显示当前和下一节点。
- 原 `flow-v1-candidate.json` 的 mainStart 核心顺序以 W145“是否加入高专”开始，随后含 W171、W172、W36、W170、W93、W95-W97；涩谷入口和结果边界含 W143、W132、W149、W148、W150、W151、W152、W153、W98、W69 及三个内联收敛轮盘。
- 第一章河岸事件定位为进入原主线前的教学桥接，不冒充上述原转盘结果。第一章结束明确指向 W145。
- 现有 battle 已有完整的登录卡投影和标签发牌链路；故事入口现在直接使用转盘快照，经 `LoginCardCharacterProjector` 和 `BattleEligibility` 生成真实资源与牌池。第一章只固定敌方为河岸低级咒灵，不固定玩家角色。
- Godot 现有 auth/battle 子场景保留数条 invalid UID 元数据警告，会回退到文本路径并成功加载；它们不是本轮引入的运行错误。

- 官方在线服务已实际部署 V3 resolver/socket 与 Nginx WebSocket 代理修复；原生 Node WebSocket 和 Godot 双端均能完成到 FINISHED 的真实战斗。Godot 客户端根因是 OPEN 竞态丢弃 subscribe 帧，已改为发送成功后才清队列。
- 攻略型NPC适合独立于普通剧情NPC建模：关系由好感、信任、认可、兼容度和旗标组成，路线阶段取所有满足条件的最高阶段；不能按配置数组第一项直接返回，否则高阶段永远无法解锁。
- 伙伴战斗收益不应绕过现有角色投影与发牌链。把援护建模为 `customHandCards`，再由投影器保留 `guaranteedPerTurn` 和 `handSource`，可以同时复用卡牌展示、选择、CE消耗和V3权威结算。
- `ActionResolverV3._apply_derived_stats` 原先把运行中的 `guard` 当成派生基础值在每个行动前重置，导致先行动的防御/援护在对手攻击前消失；`guard` 属于回合内可变资源，应由回合流程清理而非每次行动重算时清理。
- 关系反馈应使用结算页已有的“人物关系”区域。把关系详情追加到左侧事件回顾会造成文本越界，也会弱化资源、成长、关系、调查四类结果的视觉分工。
- 核心节点不能只存在于时间线JSON：RPG框架必须读取节点自己的 `rpgLines` 与 `choices`，并通过 `resolve_core_choice` 保留源 wheelId、选项值和下一个核心节点；地图还必须按当前核心节点动态显示预留入口，避免 W145 结算后重复进入 W145。
- 原始核心轮盘不是固定二选一：W171有3项，W172有4项。RPG框架通过复制既有按钮纹理在运行时扩展选项，保留同一套点击反馈、转场和统一结算，不把多选轮盘错误压成二选一。
- 文件1中的普通节点需要和核心节点使用同一套 `StoryState.resolve_local` 与 settlement；随机节点只改变普通状态，分支节点保存玩家选择，高危节点由真实战斗决定结果，不能把三者都当作静态地图按钮。
- 隐式转盘不能只依赖固定字符串哈希，否则每次新开局都得到同一结果；使用保存的 `run_seed` 加历史和资源状态既能在存档中复现，也能让重新开始产生新事件。
- 涩谷主线必须先经过 W143 参加门，再经过 W132 阵营门；高专方进入 W149/W148，羂索方和第三方进入 W98。不能从 W95 直接跳进高专涩谷开场，否则会绕过原始阵营分流。
- 核心节点的选择不应只保存 `core_choice` 文本；W69 等结果还需要把资源、成长和旗标作为 `resolve_core_choice` 的参数走统一 pending-result 提交流程，才能让结算和后续条件看到真实后果。
- 文件2的核心选项中出现“对战”时，不能仅以 RPG 文本代替；使用选项上的 `battleNode` 元数据进入 `core_battle_*`，先提交原始轮盘选择，再用节点 `next` 接回原时间线，才能同时保留轮盘因果和真实战斗。
- 原轮盘选项文本中的“无法参与”必须成为可执行条件，而非仅显示在结算文字中；核心选择现可写 `storyFlags`，后续有限选项通过同一条件过滤器隐藏不合法路线。
- 源时间线中的 `sourceType: wheel` 收敛节点即使没有 wheelId 也必须保留为手动核心节点；使用 `sourceWheelId: 0`、原始选项文本和 `core_wheel_manual` 记录，避免把世界状态判断误当作AI或普通随机事件。
- 源时间线 `shibuyaOutcome` 明确是 `weighted_choice`，所以应使用本地隐式抽取而非增加第四个手动选项；结果仍需写入旗标并经过统一结算。
- `shibuyaOutcome` 的基础三项权重相同，但源文件要求按参与阵营偏置；把偏置配置在每个 outcome 的 `weightByFlag`，由统一抽取器读取，避免在场景脚本里硬编码阵营判断。
- 涩谷阶段不能在 `core_shibuya_end` 直接结束：源文件明确存在 `cullingGame` 段。应先判断计划是否能发动，不能发动时走三项替代结局，能发动时再进入 W144 和 W55；当前已形成这条入口链。
- 普通随机节点不能只改变数值；抽取结果必须成为后续交互条件。当前通过 `storyFlags` 写入局内事实，再由 `requiresFlags`、`excludesFlags`、`minResources`、`minGrowth` 生成分支选项。
- 地图完成条件存在多路线时不能只写单一 `requires`；文件1的普通战斗与高危战斗是并列完成路径，使用 `requiresAny` 表达并由地图统一判定。
# 2026-09-15 — 联机对战诊断与修复

- 玩家入口默认进入“匹配赛”，但客户端过去把 `queueMatch` 映射为 `matchmaking_not_deployed`，同时正式/本地 V3 权威服务也没有 `queue_match`。所以“刷新服务器”和“开始匹配”都会变成错误，虽然自建房间战斗本身可用。
- 根因已用真实网络请求复现：正式地址 `https://119.91.224.223/preview-room-api` 健康且能完成 create/join/lock/bootstrap/strategy，但 `queue_match` 返回 `400 INVALID_REQUEST`。
- 本地修复后的权威服务会让首名玩家进入 `MATCHMAKING`，第二名玩家加入同一 `ranked_1v1` 房间并令状态变为 `LOBBY`；双方锁定后仍由 V3 真实战斗权威推进，不会生成客户端伪结果。
- 正式服务尚未部署本次后端更新。客户端在检测到该旧版本错误时改为创建 1v1 邀请房间，因此当前版本不再把匹配按钮留在错误状态，玩家可复制房间码继续联机。
# 2026-09-16 文件1节点链复核

- 文件1的八类节点均有可解析定义；普通节点现在从 `chapter1.json` 生成对白和选项，运行时不再为线索剧情写死分支效果。
- 隐式转盘仍只用于 `random` 节点；`branch` 和普通 `rpg` 节点均由玩家手动确认，核心 `core_*` 节点继续禁止 AI 代选。
- 所有普通节点结果统一调用 `StoryState.resolve_local`，再由 `settlement.tscn` 调用 `commit_pending`，确保资源、成长、NPC关系和剧情旗标一次提交。
- 新验收：`CHAPTER1_DATA_DRIVEN_ACCEPTANCE PASS intro=true clue_choices=true result=true`。
