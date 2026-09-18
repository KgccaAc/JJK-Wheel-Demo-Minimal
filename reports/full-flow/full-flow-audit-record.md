# 第一章完整流程审计记录

生成时间：2026-09-17
运行方式：Godot 真实窗口 + `Viewport.push_input` 鼠标按下/释放事件
主报告：`reports/full-flow/full-flow-latest.json`
截图目录：`reports/full-flow/screenshots/`

## 总体结果

- 结果：通过
- 失败项：0
- 主线步骤：11 个阶段
- 截图：11 张
- 验收输入：渲染窗口鼠标事件
- 全流程：角色认定 → 模式选择 → 故事首页 → RPG → 四时段交互 → 统一结算 → 地图 → RPG → 战斗 → 最终结算 → 地图

## 逐步记录

| 序号 | 页面/阶段 | 实际操作 | 预期结果 | 实际结果 | 截图 |
|---:|---|---|---|---|---|
| 1 | Identity 角色认定 | 打开角色认定；点击姓名；输入“改名后的验收术师”；提交；点击继续 | 姓名可编辑，改名写回 StoryState，继续进入 Select | 通过；姓名编辑器可点击，长姓名布局正常，评级/属性/特质/咒具显示正常 | `01_identity.png` |
| 2 | Select 模式分流 | 点击故事模式 | 进入 StoryHome | 通过；场景切换成功 | `02_select.png` |
| 3 | StoryHome 故事首页 | 检查 Forum 紫色选中态；打开 More；打开 User；打开角色选择；选择登录卡角色；点击开始 | 导航、设置、用户面板和角色来源均可用；登录卡角色进入 RPG | 通过；内置角色与登录卡角色列表合并，选择后进入 RPG | `03_story_home.png` |
| 4 | RPG 序幕 | 逐次点击正文推进；检查正文整块点击区；检查 Speaker 居中；检查普通选项不显示 IfFight；点击选项 | 对话可推进，选项可点击，非战斗选项不误标战斗 | 通过；正文点击区覆盖文本面板，选项层级可用，进入 Selection | `04_rpg.png` |
| 5 | Selection 四时段 | 依次选择观察、交谈、搜索、休息；每段点击确认 | 每段产生本地结果，资源/成长变化写入，时间推进 | 通过；四个时段全部完成 | `05_selection.png` |
| 6 | Selection 结果停留 | 观察行动后等待 1.35 秒不点击 | 结果文本仍停留，不能自动跳时段 | 通过；结果显示保持，第二次确认才推进 | `06_selection_result.png` |
| 7 | Settlement 首次结算 | 点击 Review；点击 History；点击继续 | Review 显示角色报告/小说入口；History 显示经历；继续进入地图 | 通过；Reflect 为摘要，统一结算完成 | `07_settlement.png` |
| 8 | Map 地图推进 | 点击线索节点并进入；完成 RPG 节点；回到地图；点击战斗节点并进入 | 地图是主推进页，节点状态更新，战斗节点复用真实 Battle | 通过；RPG 结算后回地图，再进入 Battle | `08_map.png` |
| 9 | Battle 真实战斗 | 检查战斗会话、两个 actor、phase；结束战斗 | 战斗状态正常初始化，战后回统一结算 | 通过；角色/发牌/phase 可用，战斗结束进入 Settlement | `09_battle.png` |
| 10 | Settlement 最终结算 | 再次查看 Review/History；点击继续 | 最终资源、成长、经历、小说报告可查看，节点完成 | 通过；最终结算成功 | `07_final_settlement.png` |
| 11 | Map 完成态 | 进入最终地图 | 已完成节点显示灰色蒙层，章节状态为已完成 | 通过；完成节点蒙层和章节状态正确 | `08_final_map.png` |

## 额外导航检查

StoryHome 底部导航逐项验证：

- Home → `home.tscn`
- Character → `roster_picker.tscn`
- Battle → `battle_scene.tscn`
- Forum → `community.tscn`
- Archive → `online_room.tscn`

五条路径均已在真实窗口脚本中点击并验证目标场景。

## 记录范围与限制

- 本次流程证明了第一章本地故事主线、真实战斗、统一结算和地图完成态的可达性。
- AI 普通节点接口保留并有本地回退；本次主线采用基础本地逻辑，未把外部 AI 服务作为通过条件。
- 官方 Web 导出、跨浏览器 CORS、双标签页联机属于独立验收范围，不能由本次本地 Godot 窗口记录替代。
- 当前仍有 6 条旧 `.tscn` invalid UID 警告，Godot 已回退文本路径加载；它们没有导致本次流程失败。

## 对应证据

- `reports/full-flow/full-flow-latest.json`
- `reports/full-flow/real-window-flow-latest.log`
- `reports/self-improve/self-improve-latest.json`
- `reports/acceptance-latest.json`
- `reports/ui-audit/page-button-wiring-latest.json`

## 独立复核结论

独立审计由子 agent 在不修改工程代码的前提下完成，完整报告见 `reports/full-flow/subagent-audit.md`。

- P0：未发现已复现的流程卡死。
- P1：完整流程尚未用真实玩家输入走完一个战斗回合；目前只验证战斗初始化后通过验收钩子进入结算。
- P1：首次结算页的长事件回顾存在底部遮挡风险。
- P1：第一章完成地图仍显示“进入节点”主按钮，但实际只显示小样结束提示，终点语义不够明确。
- P1：战斗首屏缺少醒目的阶段、选中数量、确认与取消反馈。
- P2：角色认定的左下元信息栅格、图标底栏文字、四时段行动预期结果、行动结果变化条、RPG 继续提示和旧 UID 警告仍可提升。

本记录的“通过”仅表示已覆盖范围内的本地故事链路可达；以上 P1 未被当前主线成功结果掩盖，后续验收应优先扩展真实战斗输入路径。
