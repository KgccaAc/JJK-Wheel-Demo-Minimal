class_name ActionCostResolver
extends RefCounted

## 基础 CE 成本的无状态计算器。
## 输入仅为卡牌成本与最大 CE；生产调用必须经 BattleResolutionPipeline，不能由 UI 或会话外代码拼接修正。
func resolve_ce_cost(cost: Dictionary, max_ce: float, action_ce_delta: float = 0.0) -> float:
	var explicit_cost: float = float(cost.get("ce", 0.0))
	var ratio_cost: float = maxf(0.0, max_ce * float(cost.get("ceRatio", 0.0)))
	var minimum_cost: float = maxf(0.0, float(cost.get("minCe", 0.0)))
	var base_cost: float = maxf(maxf(explicit_cost, ratio_cost), minimum_cost)
	return maxf(0.0, base_cost + action_ce_delta)

