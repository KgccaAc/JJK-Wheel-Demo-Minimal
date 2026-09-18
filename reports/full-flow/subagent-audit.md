# 第一章流程与画面独立审计

审计时间：2026-09-17  
审计范围：`full-flow-audit-record.md`、`full-flow-latest.json`、真实窗口流程脚本、最新 11 张截图与故事/战斗关键流程代码。  
审计结论：第一章的本地故事主线已可从角色认定连续到最终地图；没有发现已复现的 P0 卡死。当前最大缺口是“真实玩家操作完成一个战斗回合”没有被完整流程脚本覆盖，且数个页面对结果、可点击性和章节终点的表达仍可优化。

## 已证实的链路

`full-flow-latest.json` 状态为 `passed`、失败项为空，且运行输入是渲染窗口鼠标事件。11 张截图覆盖：角色认定、模式分流、故事首页、RPG、四时段选择与结果、两次结算、两次地图及战斗入口。流程记录还证明 StoryHome 的五个底部导航、More、User 和登录卡角色选择均能到达目标页面。

以下结论仅适用于第一章的本地故事模式；流程记录也已正确注明，Web/CORS 双端联机和外部 AI 服务没有被该次运行替代。

## P0：阻断性问题

未发现已复现的 P0 问题。

- 四时段结果不会自动跳过：`06_selection_result.png` 中结果页保持可见；`SelectionFlow.gd` 只有第二次明确点击才调用 `_advance_after_result()`。
- 地图进入按钮有重入防护和解锁校验：`MapFlow.gd` 的 `entering_node`、锁定提示和按钮复位能避免重复点击造成的同页重入。
- RPG 普通选项不显示错误的战斗标识，正文点击区和选项层级均被真实窗口脚本断言。

## P1：应优先处理

### 1. 战斗的“完整手动回合”尚未被全流程验收覆盖

**证据**：`StoryRealWindowFlowAcceptance.gd` 在到达战斗页后，验证 session、2 个 actor 和 phase，随后直接调用 `FightPresenter._finish_story_battle("left")` 返回结算。`09_battle.png` 也停留在战斗倾向选择面板，并未呈现玩家选择、出牌、结算、下一回合和战斗胜负的完整可见链路。

**影响**：现有报告能证明故事可以进入真实 Battle 场景并从其中回到 Settlement，不能证明首次进入的玩家能靠界面完成一整回合，更不能证明战斗控件在这一故事角色数据下始终可操作。

**建议**：扩展真实窗口验收为“选择倾向 → 确认/发牌 → 选择牌 → 结算 → 下一回合或胜负 → Settlement”。断言每一阶段按钮的 visible/enabled 状态和状态 revision；不要用私有结束函数替代玩家输入。

### 2. 结算页的事件回顾发生文字遮挡，结果难以阅读

**证据**：`07_settlement.png` 左侧“事件回顾”正文从图片下方延伸至底部，末行被底部状态条和“记录已保存”区域压住；`07_final_settlement.png` 同一位置虽较短，但结构仍没有限制长文本。

**影响**：四时段事件写入越多，玩家越难读到本次关键因果，削弱结算页作为“选择反馈”的作用。

**建议**：回顾区域使用固定高度 `RichTextLabel`/滚动容器，正文限制在图片区以下的可视区；首段显示摘要，完整记录交给“完整回顾”弹窗。对最长的四时段合并文本加截图验收。

### 3. 第一章完成态仍提供“进入节点”的强主按钮，终点语义冲突

**证据**：`08_final_map.png` 左侧显示“第一章·仙台的异乡人 已完成”，中央当前节点却是“是否加入高专”，底部红色主按钮仍写“---进入节点---”。`MapFlow.gd` 对 `chapter1_end` 点击后只弹出“当前小样在此结束”的提示。

**影响**：玩家会预期该按钮能进入下一段内容，实际只收到提示，完成感被一次无效主操作打断。

**建议**：完成态改为明确的“查看第一章结局”或“下一章开发中”，并在同区域展示已完成、关键选择及可解锁条件。若仍保留入口，先显示结束卡，再提供回顾/重开/返回首页的明确操作。

### 4. 战斗首屏的信息层级和确认反馈不足

**证据**：`09_battle.png` 同屏呈现七张战斗倾向卡，顶部状态数值很小，左侧竖栏字色接近背景；屏内未见当前已选数量、确认按钮、取消按钮或阶段说明。真实流程脚本也未用这些控件推进。

**影响**：首次玩家难以判断“现在必须选几张、选完在哪里确认、这一步怎样影响本回合”。

**建议**：增加醒目的阶段标题（例如“选择 1 项战斗倾向”）、选中描边和数量计数，并固定显示主确认按钮；将 HP/CE 与回合提示提升到安全可读字号。每步完成后加入短暂结果条，说明伤害、资源和状态变化。

## P2：体验与可读性改进

### 1. Identity 页左下元信息存在拥挤和互相覆盖

**证据**：`01_identity.png` 的角色立绘卡底部，“女”“刚满十八岁又三个多月”“咒术师”等多行文字与说明文本挤在同一区域，视觉上存在重叠；长名字虽然已在中部身份卡正确显示，但立绘卡仍缺乏稳定的信息栅格。

**建议**：将年龄、性别、时间线和阵营收进两列固定字段，名称单独占行；长字段截断并给出详情弹窗或 tooltip。使用最长年龄与阵营文本做分辨率截图检查。

### 2. Select 与 StoryHome 的底部导航全为图标，页面语义不够直接

**证据**：`02_select.png`、`03_story_home.png` 的底栏只有五个图形；截图中无法由画面直接判断“角色、战斗、论坛、联机”对应关系，当前紫色选中态只能表示位置，不能传达名称。

**建议**：为选中项显示短标签，或在首次使用时显示一次图标名称；保持 tooltip 作为补充，而不把基础导航理解完全交给悬停。

### 3. 四时段行动卡只有图标，行动差异和预期回报不够可预判

**证据**：`05_selection.png` 中四张卡主要显示眼睛、对话、搜索、休息图标；底部小图标没有文字说明，右侧“确认选择”也没有复述当前选择的名称与风险/收益。

**建议**：在卡片中显示“观察/交谈/搜索/休息”标题和一行预期倾向，例如“线索 +，稳定性风险低”。确认按钮上方显示当前行动名称；结果页明确标出本次资源与成长的增减来源。

### 4. 结果页已能停留，但“发生了什么改变”仍需要更明确的视觉反馈

**证据**：`06_selection_result.png` 显示“进入下一时段”和右上资源数值，但资源变化只体现在新的总值，页面没有独立的 `+经验/-稳定` 结果条；相比之下，Settlement 已有清晰的蓝/红变化数值。

**建议**：在行动结果下加一条短结果条，使用同一套图标、颜色和正负号；点“进入下一时段”前让玩家先看到行动文本、影响、下一时段名称三项。

### 5. RPG “点击继续”提示在深色背景角落对比度偏低

**证据**：`04_rpg.png` 的“点击继续”位于文本框右下角，文字靠近花纹边框，尺寸和对比度低于对话正文；左上“跳过剧情”也较小，容易被背景信息吸收。

**建议**：将继续提示置于独立的高对比按钮区，提供键盘确认提示；跳过使用二次确认，并明确本次跳过会保留/放弃哪些剧情结果。

### 6. 流程记录中的旧 invalid UID 警告仍应清理

**证据**：`real-window-flow-latest.log` 有多条 `.tscn` 的 invalid UID 警告，涉及 Battle、Roster、Community、OnlineRoom 等场景，当前由文本路径回退加载。

**影响**：当前流程未失败，但资源重命名、Web 导出或后续合并时会放大为加载风险，且日志噪声掩盖真正错误。

**建议**：逐一重存对应场景或刷新外部资源 UID，随后要求真实窗口日志在主流程中不含 invalid UID 警告。

## 验收建议顺序

1. 先补真实鼠标驱动的完整战斗回合和胜负结算验收。
2. 修复 Settlement 回顾文本溢出，并用最长事件文本截图复验。
3. 调整第一章完成态 CTA，避免“可进入但无内容”的主操作。
4. 提升战斗阶段、四时段选择和底部导航的可发现性。
5. 清理 UID 警告，并分别做 Web/CORS 双端联机验收。

## 证据索引

- `reports/full-flow/full-flow-audit-record.md`
- `reports/full-flow/full-flow-latest.json`
- `reports/full-flow/screenshots/01_identity.png`
- `reports/full-flow/screenshots/02_select.png`
- `reports/full-flow/screenshots/03_story_home.png`
- `reports/full-flow/screenshots/04_rpg.png`
- `reports/full-flow/screenshots/05_selection.png`
- `reports/full-flow/screenshots/06_selection_result.png`
- `reports/full-flow/screenshots/07_settlement.png`
- `reports/full-flow/screenshots/08_map.png`
- `reports/full-flow/screenshots/09_battle.png`
- `reports/full-flow/screenshots/07_final_settlement.png`
- `reports/full-flow/screenshots/08_final_map.png`
- `tests/godot/StoryRealWindowFlowAcceptance.gd`
- `scenes/story/MapFlow.gd`
- `scenes/story/SelectionFlow.gd`
- `scenes/story/SettlementFlow.gd`
- `scenes/story/RpgFlow.gd`
