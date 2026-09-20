# Community scenes

`community.tscn` is the shell scene for the 1672 × 941 design viewport. It owns the shared header, page tabs, and footer; its two direct content children are intentionally kept as separate scenes:

- `community_vote.tscn` — agenda voting and faction balance.
- `community_discussion.tscn` — free-discussion list and reply detail.

## Navigation

Call `Community.show_vote_page()` or `Community.show_discussion_page()` from the surrounding menu/router. The two texture tabs are already wired to those methods.

## Faction-bar integration

`CommunityVote` renders colored fills *below* the hollow progress-frame art. Feed current faction ratios with:

```gdscript
$Community/VotePage.set_faction_balance(pro_ratio, con_ratio)
$Community/VotePage.set_topic_balance(pro_vote_count, con_vote_count)
```

The ratio method normalizes any non-negative pair and emits `faction_balance_changed(pro_ratio, con_ratio)` after rendering. This keeps visual state decoupled from a future server, event, or battle controller.

The current topic labels and discussion entries are placeholder presentation data. Replace them through a dedicated community data presenter when the backend contract is introduced; do not couple networking directly into the scene script.

