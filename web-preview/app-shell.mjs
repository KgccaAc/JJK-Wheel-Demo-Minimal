import { loadStoryPackage } from '/web-runtime/content-loader.mjs';
import { StoryClient } from '/web-runtime/story-client.mjs';
import { SaveService } from '/web-runtime/save-service.mjs';
import { BattleClient } from '/web-runtime/battle-client.mjs';
import { WheelFlowRuntime } from '/web-runtime/wheel-runtime.mjs';
import { OnlinePreviewClient } from '/web-runtime/online-client.mjs';

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const clone = (value) => structuredClone(value);

class HttpService {
  constructor(fetchImpl = globalThis.fetch) { this.fetchImpl = fetchImpl === globalThis.fetch ? fetchImpl.bind(globalThis) : fetchImpl; }
  async json(path, options = {}) {
    const response = await this.fetchImpl(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
    const payload = await response.json();
    if (!response.ok) { const error = new Error(payload?.error || `http_${response.status}`); error.status = response.status; error.payload = payload; throw error; }
    return payload;
  }
  get(path) { return this.json(path, { method: 'GET' }); }
  post(path, body) { return this.json(path, { method: 'POST', body: JSON.stringify(body) }); }
}

class WebStoryApp {
  constructor() {
    this.http = new HttpService();
    const requestedSaveId = new URLSearchParams(location.search).get('save');
    this.save = new SaveService(this.http, requestedSaveId || 'web-story-local');
    this.package = null; this.client = null; this.battle = null; this.wheel = null; this.online = new OnlinePreviewClient(); this.wheelConfig = null; this.wheelPendingResult = ''; this.battleSelection = []; this.lastEvents = [];
    this.main = $('#main'); this.bindNavigation(); window.addEventListener('hashchange', () => this.route());
  }
  async boot() {
    try {
      const [result, ai, wheel] = await Promise.all([this.http.get('/api/story/packages/latest'), this.http.get('/api/ai/status').catch(() => ({ enabled: false, fallbackMode: true })), this.http.get('/api/wheel/config')]);
      this.package = result.package; $('#content-version').textContent = this.package.contentVersion;
      this.wheelConfig = wheel.config;
      const aiReady = (ai.enabled ?? ai.configured) && ai.modelAvailable !== false && !ai.fallbackMode;
      const aiStatus = $('#ai-status'); aiStatus.textContent = aiReady ? `AI · ${ai.model || 'DeepSeek'}` : 'AI · 本地回退'; aiStatus.className = `status-dot ${aiReady ? '' : 'offline'}`;
      const snapshot = await this.save.load();
      this.client = new StoryClient({ packageData: this.package, snapshot, onEvents: (events) => this.onEvents(events) });
      this.wheel = new WheelFlowRuntime({ ...this.wheelConfig, seed: snapshot.wheelSnapshot?.seed || 20260920, snapshot: snapshot.wheelSnapshot || {} });
      if (snapshot.battleSession?.battleId) {
        this.battle = new BattleClient({ snapshot: snapshot.battleSession });
        try { await this.battle.resume(); this.client.runtime.state.battleSession = this.battle.snapshot(); }
        catch { this.battle = null; this.client.runtime.state.battleSession = null; }
      }
      if (!snapshot.currentNodeId || !Array.isArray(snapshot.history) || snapshot.history.length === 0) this.client.start();
      $('#save-status').textContent = `存档 ${this.save.revision}`;
      this.route();
    } catch (error) { this.renderError('Web 故事服务未就绪', error.message); }
  }
  bindNavigation() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#/"]'); if (!link) return;
      const route = link.getAttribute('href').slice(2); if (route === 'story' && !this.client) event.preventDefault();
      if (route !== 'story' || this.client) queueMicrotask(() => this.route());
    });
  }
  async route() {
    const route = (location.hash.replace(/^#\//, '') || 'home').split('/')[0];
    document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === route));
    if (route === 'story') return this.renderStory();
    if (route === 'home') return this.renderHome();
    if (route === 'wheel') return this.renderWheel();
    if (route === 'battle') return this.renderStandaloneBattle();
    if (route === 'online') return this.renderOnline();
    this.renderModule('未找到页面', '这个路径没有对应的模块。', '返回首页继续。');
  }
  onEvents(events) {
    this.lastEvents = events || [];
    const interesting = events.filter((event) => ['node_entered', 'choice_selected', 'dialogue_completed', 'battle_resolved', 'ai_session_started', 'ai_dialogue_resolved', 'apply_effect', 'runtime_error', 'end'].includes(event.type));
    if (interesting.length && this.client) this.persist(interesting);
    if (location.hash.startsWith('#/story')) this.renderStory();
  }
  async persist(events) {
    const result = await this.save.commit(this.snapshotForSave(), events);
    $('#save-status').textContent = result.conflict ? `存档冲突 · 本地已保存` : `存档 ${this.save.revision}`;
  }
  snapshotForSave() { const snapshot = this.client?.snapshot?.() || {}; if (this.wheel) snapshot.wheelSnapshot = this.wheel.snapshot(); return snapshot; }
  renderWheel() {
    if (!this.wheel) return this.renderError('转盘内容未就绪', '无法加载版本化转盘配置。');
    const task = this.wheel.currentTask || this.wheel.start(); const snapshot = this.wheel.snapshot();
    if (task.type === 'end') {
      this.main.innerHTML = `<section class="panel route-card wheel-result"><div class="eyebrow">WHEEL COMPLETE</div><h1>角色生成完成</h1><div class="wheel-grade"><span>综合评级</span><b>${escapeHtml(snapshot.grade?.grade_label || '未定')}</b><small>${Number(snapshot.grade?.score || 0).toFixed(1)} / 100</small></div><p>已完成 ${Object.keys(snapshot.answers || {}).length} 项转盘结果；结果已写入当前存档，可继续进入故事或战斗。</p><div class="actions"><a class="action" href="#/story">进入故事模式</a><a class="action secondary" href="#/battle">进入基础战斗</a></div></section>`;
      return;
    }
    const options = task.type === 'choice' ? (task.options || []).map((option) => ({ text: option.text || option.label || option.value, value: option.text || option.label || option.value })) : [];
    const items = task.type !== 'choice' ? (task.items || []).slice(0, 12).map((item) => item.text || item.label || item) : [];
    const pending = this.wheelPendingResult ? `<div class="wheel-pending"><span>本次结果</span><b>${escapeHtml(this.wheelPendingResult)}</b><button class="action" data-wheel-accept>确认结果</button></div>` : '';
    const controls = task.type === 'computed_grade' ? '<button class="action" data-wheel-grade>计算综合评级</button>' : this.wheelPendingResult ? pending : task.type === 'choice' ? `<div class="wheel-options">${options.map((option) => `<button class="action secondary" data-wheel-option="${escapeHtml(option.value)}">${escapeHtml(option.text)}</button>`).join('')}</div>` : '<button class="action" data-wheel-roll>旋转并锁定结果</button>';
    this.main.innerHTML = `<section class="panel route-card wheel-panel"><div class="eyebrow">WEB WHEEL · ${escapeHtml(task.nodeId || '')}</div><h1>${escapeHtml(task.title || '转盘')}</h1><p class="muted">结果来自版本化转盘配置；确认前不会写入角色存档。</p><div class="wheel-dial"><div class="wheel-pointer">◆</div><div class="wheel-items">${items.map((item) => `<span>${escapeHtml(item)}</span>`).join('') || '<span>结构化选择</span>'}</div></div>${controls}<div class="wheel-meta">已完成 ${Object.keys(snapshot.answers || {}).length} 项 · 跳过 ${snapshot.skipped?.length || 0} 项</div><div class="actions"><a class="action secondary" href="#/home">暂存并返回首页</a></div></section>`;
    $('[data-wheel-roll]')?.addEventListener('click', () => { this.wheelPendingResult = this.wheel.roll(); this.renderWheel(); });
    $('[data-wheel-accept]')?.addEventListener('click', () => { const result = this.wheel.accept(this.wheelPendingResult); this.wheelPendingResult = ''; this.persist([{ type: 'wheel_result', nodeId: task.nodeId, value: result.events?.[0]?.value || '' }]); this.renderWheel(); });
    $('[data-wheel-option]')?.addEventListener('click', (event) => { this.wheel.accept(event.currentTarget.dataset.wheelOption); this.persist([{ type: 'wheel_result', nodeId: task.nodeId, value: event.currentTarget.dataset.wheelOption }]); this.renderWheel(); });
    $('[data-wheel-grade]')?.addEventListener('click', () => { this.wheel.computeGrade(); this.wheel.accept(this.wheel.snapshot().grade.grade_label); this.persist([{ type: 'wheel_grade', grade: this.wheel.snapshot().grade }]); this.renderWheel(); });
  }
  renderStandaloneBattle() {
    if (!this.client) return this.renderLoading();
    const node = { id: 'web_standalone_battle', type: 'battle', title: '基础战斗', encounterId: 'river_low_grade_curse' };
    this.main.innerHTML = `<section class="panel route-card"><div class="eyebrow">WEB BATTLE · V3 AUTHORITY</div><h1>基础战斗</h1><p>这里使用故事战斗相同的真实牌库、CE、弃牌、先手、出牌和结算协议。</p>${this.battlePanel(node)}<div class="actions"><a class="action secondary" href="#/story">返回故事模式</a></div></section>`;
    this.bindStoryActions(node, true);
  }
  renderOnline() {
    this.main.innerHTML = `<section class="panel route-card online-panel"><div class="eyebrow">PREVIEW ONLINE · SERVER AUTHORITY</div><h1>联机大厅</h1><p>当前页面只连接预览房间路径；房间、锁定、战斗状态和结算由服务器权威维护。</p><div id="online-health" class="notice">正在检查预览房间服务…</div><div class="online-form"><label>房间代码<input id="online-room-code" placeholder="创建后将显示房间代码"></label><div class="actions"><button class="action" data-online-create>创建预览房间</button><button class="action secondary" data-online-join>加入房间</button><button class="action secondary" data-online-lock>锁定当前角色</button></div></div><div id="online-room" class="log"></div><div class="notice">正式根地址不会由此页面直接写入；部署时仅配置 /preview-room-api 预览代理。</div><div class="actions"><a class="action secondary" href="#/story">回到故事模式</a></div></section>`;
    const profile = () => ({ id: `web-character-${this.save.saveId}`, displayName: 'Web 转盘角色', stats: { body: 'B', martial: 'B', cursed_energy: 'B', control: 'B', efficiency: 'B', talent: 'B' }, cards: [] });
    const showRoom = () => { const room = this.online.room; if (!room) return; $('#online-room').innerHTML = `<div class="log-entry">房间：<b>${escapeHtml(room.roomId)}</b> · 状态：${escapeHtml(room.state || 'LOBBY')} · 修订：${Number(room.revision || 0)} · 成员：${room.members?.length || 0}</div>`; $('#online-room-code').value = room.roomId; };
    this.online.health().then((health) => { $('#online-health').textContent = health?.ok ? '预览房间服务在线，可以创建或加入房间。' : '预览房间服务返回异常。'; }).catch((error) => { $('#online-health').textContent = `预览服务不可用：${error.message}`; $('#online-health').classList.add('error'); });
    $('[data-online-create]').addEventListener('click', async () => { try { await this.online.createRoom(profile()); showRoom(); } catch (error) { $('#online-health').textContent = `创建失败：${escapeHtml(error.message)}`; $('#online-health').classList.add('error'); } });
    $('[data-online-join]').addEventListener('click', async () => { try { await this.online.joinRoom($('#online-room-code').value.trim(), profile()); showRoom(); } catch (error) { $('#online-health').textContent = `加入失败：${escapeHtml(error.message)}`; $('#online-health').classList.add('error'); } });
    $('[data-online-lock]').addEventListener('click', async () => { try { await this.online.lockCharacter(true, profile()); showRoom(); } catch (error) { $('#online-health').textContent = `锁定失败：${escapeHtml(error.message)}`; $('#online-health').classList.add('error'); } });
  }
  renderHome() {
    if (!this.package) return this.renderLoading();
    const nodes = Object.keys(this.package.nodes || {}).length; const encounters = Object.keys(this.package.encounters || {}).length;
    this.main.innerHTML = `<section class="hero"><div><div class="eyebrow">第一章 · 可运行 Web 垂直切片</div><h1>让每一次选择，<br><em>留下可验证的痕迹。</em></h1><p>故事内容由版本化数据包驱动，运行时只输出事件；页面、战斗和 AI 都通过服务边界接入。</p><div class="actions"><a class="action" href="#/story">继续故事</a><a class="action secondary" href="#/wheel">查看模块边界</a></div></div><aside class="panel hero-card"><div><h2>当前内容包</h2><div class="metric"><span>内容版本</span><b>${escapeHtml(this.package.contentVersion)}</b></div><div class="metric"><span>故事节点</span><b>${nodes}</b></div><div class="metric"><span>战斗入口</span><b>${encounters}</b></div><div class="metric"><span>角色卡</span><b>${Object.keys(this.package.characters || {}).length}</b></div></div><div class="notice">保存、AI 和内容校验均通过本地预览 API；正式联机服务不被本地存档层接管。</div></aside></section><section class="section-title"><h2>功能模块</h2><span class="muted">按业务边界接入，不共享页面内部状态</span></section><section class="module-grid">${[['故事模式','节点、选项、条件、战斗和 AI 互动'],['转盘','角色生成、术式分配、结果确认'],['基础战斗','出牌、结算、奖励与返回故事'],['联机对战','房间、重连、权威同步和结算']].map(([title,body]) => `<a class="panel module-card" href="#/${title === '故事模式' ? 'story' : title === '转盘' ? 'wheel' : title === '基础战斗' ? 'battle' : 'online'}"><div class="eyebrow">MODULE</div><h3>${title}</h3><p>${body}</p></a>`).join('')}</section>`;
  }
  renderStory() {
    if (!this.client) return this.renderLoading();
    const runtime = this.client.runtime; const node = runtime.currentNode(); if (!node) return this.renderError('故事节点不存在', runtime.state.currentNodeId);
    if (runtime.state.status === 'setup') this.client.start();
    const choices = runtime.choicesFor(node); const speaker = node.speakerId ? this.package.characters?.[node.speakerId]?.displayName || node.speakerId : '旁白';
    const isAi = node.type === 'ai_dialogue'; const isBattle = node.type === 'battle';
    const lines = Array.isArray(node.rpgLines) ? node.rpgLines.filter((line) => line?.text) : [];
    const body = node.dialogue || node.text || node.summary || lines[0]?.text || (isBattle ? `战斗入口：${node.encounterId || '未命名 encounter'}` : '当前节点等待输入。');
    const linesHtml = lines.length > 1 ? `<div class="story-lines">${lines.map((line) => `<p><b>${escapeHtml(line.speaker || '旁白')}</b>${escapeHtml(line.text)}</p>`).join('')}</div>` : '';
    const slotsHtml = Array.isArray(node.timeSlots) && node.timeSlots.length ? `<div class="time-slots"><span class="muted">行动时段</span>${node.timeSlots.map((slot) => `<button class="slot ${runtime.state.timeSlot === slot ? 'selected' : ''}" data-time-slot="${escapeHtml(slot)}">${escapeHtml(slot)}</button>`).join('')}</div>` : '';
    const battleHtml = isBattle ? this.battlePanel(node) : '';
    this.main.innerHTML = `<div class="story-layout"><section class="panel story-stage"><div class="eyebrow">${escapeHtml(node.type)} · ${escapeHtml(node.id)}</div><h1>${escapeHtml(node.title || node.id)}</h1><div class="speaker">${escapeHtml(speaker)}</div><div class="story-text">${escapeHtml(body)}</div>${linesHtml}${slotsHtml}<div class="choices">${choices.map((choice) => `<button class="choice" data-choice="${escapeHtml(choice.id)}" ${choice.enabled ? '' : 'disabled'}><span>${escapeHtml(choice.label)}</span><small>${choice.enabled ? (choice.timeSlots?.length && !runtime.state.timeSlot ? '先选时段' : '选择') : '条件未满足'}</small></button>`).join('')}</div>${!choices.length && !isAi && !isBattle && node.type !== 'end' ? '<button class="action" data-continue>继续</button>' : ''}${battleHtml}${isAi ? this.aiPanel(node) : ''}</section><aside class="panel side-panel"><h3>运行时状态</h3><div class="state-row"><span>当前节点</span><b>${escapeHtml(runtime.state.currentNodeId)}</b></div><div class="state-row"><span>运行版本</span><b>${escapeHtml(runtime.state.contentVersion)}</b></div><div class="state-row"><span>修订号</span><b>${runtime.state.revision}</b></div><div class="state-row"><span>经验</span><b>${Number(runtime.state.growth.xp || runtime.state.resources.xp || 0)}</b></div><div class="state-row"><span>旗标</span><b>${Object.keys(runtime.state.flags).length}</b></div><h3 class="section-title">最近事件</h3><div class="log">${this.lastEvents.slice(-6).map((event) => `<div class="log-entry">${escapeHtml(event.type)}${event.nodeId ? ` · ${escapeHtml(event.nodeId)}` : ''}</div>`).join('') || '<div class="muted">等待玩家操作</div>'}</div></aside></div>`;
    this.bindStoryActions(node);
  }
  aiPanel(node) { return `<div class="ai-box"><strong>NPC 互动 · ${escapeHtml(node.speakerId || 'unknown')}</strong><p class="muted">AI 只提交受控提案；关系、记忆和少量经验由服务器规则裁决。</p><textarea id="ai-input" placeholder="对 NPC 说点什么…"></textarea><div class="actions"><button class="action" data-ai-send>发送互动</button><button class="action secondary" data-ai-end>结束对话</button></div><div id="ai-reply" class="log"></div></div>`; }
  battlePanel(node) {
    if (!this.battle?.state) return '<div class="battle-box"><div class="notice">将使用现有 V3 牌库、CE、领域和结算规则启动单机权威战斗。</div><button class="action" data-battle-start>进入真实战斗</button></div>';
    const state = this.battle.state; const actors = state.actors || []; const player = actors[0] || {}; const enemy = actors[1] || {};
    const phaseTitles = { OPENING_STRATEGY: '战斗准备', DISCARD: '选择弃牌', INITIATIVE: '先手投入', PLAY: '选择出牌', FINISHED: '战斗结算' };
    const hand = player.zones?.hand || []; const selected = new Set(this.battleSelection);
    const cards = ['DISCARD', 'PLAY'].includes(state.phase) ? `<div class="battle-hand">${hand.map((card) => `<button class="battle-card ${selected.has(card.instance_id) ? 'selected' : ''}" data-battle-card="${escapeHtml(card.instance_id)}" data-damage="${Number(card.effect?.damage || card.attack || 0)}"><b>${escapeHtml(card.name || card.displayName || card.actionId || card.id)}</b><small>CE ${Number(card.cost?.ce || card.ceCost || 0)} · 伤害 ${Number(card.effect?.damage || card.attack || 0)}</small></button>`).join('')}</div>` : '';
    let controls = '';
    if (state.phase === 'OPENING_STRATEGY') controls = '<button class="action" data-battle-strategy>稳健策略</button>';
    else if (state.phase === 'DISCARD') controls = `<button class="action" data-battle-confirm="discard" ${selected.size === 2 ? '' : 'disabled'}>确认弃牌</button>`;
    else if (state.phase === 'INITIATIVE') controls = `<div class="actions">${[0,10,20,30].map((value) => `<button class="action secondary" data-battle-investment="${value}">投入 ${value} HP</button>`).join('')}</div>`;
    else if (state.phase === 'PLAY') controls = `<button class="action" data-battle-confirm="play" ${selected.size > 0 && selected.size <= 3 ? '' : 'disabled'}>确认出牌</button>`;
    else if (state.phase === 'FINISHED') controls = `<button class="action" data-battle-return>返回剧情并结算</button>`;
    return `<div class="battle-box"><h2>${phaseTitles[state.phase] || escapeHtml(state.phase)}</h2><div class="battle-status"><div><span>我方</span><b>HP ${Number(player.hp || 0)} / ${Number(player.max_hp || 0)}</b><small>CE ${Number(player.ce || 0)}</small></div><div><span>敌方</span><b>HP ${Number(enemy.hp || 0)} / ${Number(enemy.max_hp || 0)}</b><small>CE ${Number(enemy.ce || 0)}</small></div></div>${cards}${controls}<div class="log">${(state.events || []).slice(-4).map((event) => `<div class="log-entry">${event.side === 0 ? '我方' : event.side === 1 ? '敌方' : '系统'} · ${escapeHtml(event.cancelled || event.stage || event.results?.map((item) => item.cardName).filter(Boolean).join('、') || '行动已结算')}</div>`).join('')}</div></div>`;
  }
  bindStoryActions(node, standalone = false) {
    document.querySelectorAll('[data-choice]').forEach((button) => button.addEventListener('click', () => { this.client.choose(button.dataset.choice); }));
    document.querySelectorAll('[data-time-slot]').forEach((button) => button.addEventListener('click', () => { this.client.emit(this.client.runtime.setTimeSlot(button.dataset.timeSlot)); }));
    $('[data-continue]')?.addEventListener('click', () => this.client.continue());
    $('[data-battle-start]')?.addEventListener('click', () => this.startBattle(node, standalone));
    $('[data-battle-strategy]')?.addEventListener('click', () => this.submitBattle('strategy', { id: 'SteadyButton' }, standalone));
    document.querySelectorAll('[data-battle-card]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.battleCard; const selected = new Set(this.battleSelection);
      if (selected.has(id)) selected.delete(id); else if (selected.size < (this.battle?.state?.phase === 'DISCARD' ? 2 : 3)) selected.add(id);
      this.battleSelection = [...selected]; this.renderStory();
    }));
    document.querySelectorAll('[data-battle-investment]').forEach((button) => button.addEventListener('click', () => this.submitBattle('initiative', { investment: Number(button.dataset.battleInvestment) }, standalone)));
    document.querySelectorAll('[data-battle-confirm]').forEach((button) => button.addEventListener('click', () => this.submitBattle(button.dataset.battleConfirm, button.dataset.battleConfirm === 'discard' ? { ids: this.battleSelection } : { cards: this.battleSelection, domain: '' }, standalone)));
    $('[data-battle-return]')?.addEventListener('click', () => {
      const state = this.battle?.state; const victory = state?.winner && state.winner === state.actors?.[0]?.id;
      this.battle = null; this.battleSelection = []; this.client.runtime.state.battleSession = null;
      if (standalone) { this.persist([{ type: 'standalone_battle_resolved', outcome: victory ? 'victory' : 'defeat' }]); location.hash = '#/story'; }
      else this.client.battleResolved(victory ? 'victory' : 'defeat', { source: 'web_v3' });
    });
    $('[data-ai-send]')?.addEventListener('click', async () => {
      const input = $('#ai-input').value.trim(); if (!input) return;
      const reply = $('#ai-reply'); reply.innerHTML = '<div class="muted">NPC 正在回应…</div>';
      try {
        if (!this.client.ai) await this.client.startAiDialogue({ saveId: this.save.saveId, nodeId: node.id, npcId: node.speakerId, context: { chapterId: this.package.chapters?.[0]?.id } });
        const response = await this.client.sendAiTurn(input, { chapterId: this.package.chapters?.[0]?.id });
        // StoryClient emits a serialisable event and the shell re-renders the
        // view. Re-select the live reply node instead of mutating a detached
        // element from before the state transition.
        this.renderStory();
        const liveReply = $('#ai-reply');
        if (liveReply) liveReply.innerHTML = `<div class="log-entry"><b>${response.source === 'deepseek' ? 'DeepSeek' : '本地回退'}</b> · ${escapeHtml(response.message)}</div><div class="log-entry">生效：${escapeHtml(JSON.stringify(response.appliedEffects || []))}</div>`;
        $('#save-status').textContent = `AI 会话 ${response.saveRevision}`;
      } catch (error) { reply.innerHTML = `<div class="notice error">互动失败：${escapeHtml(error.message)}</div>`; }
    });
    $('[data-ai-end]')?.addEventListener('click', async () => { await this.client.endAiDialogue(); this.renderStory(); });
  }
  async startBattle(node, standalone = false) {
    try {
      this.battle = new BattleClient(); this.battleSelection = [];
      await this.battle.start({ saveId: this.save.saveId, encounterId: node.encounterId, seed: this.client.snapshot().randomSeed });
      await this.persistBattle('battle_started'); standalone ? this.renderStandaloneBattle() : this.renderStory();
    } catch (error) { this.battle = null; this.renderError('战斗启动失败', error.message); }
  }
  async submitBattle(stage, data, standalone = false) {
    try {
      await this.battle.submit(stage, data); this.battleSelection = [];
      await this.persistBattle('battle_stage_resolved'); standalone ? this.renderStandaloneBattle() : this.renderStory();
    } catch (error) { this.renderError('战斗操作失败', error.message); }
  }
  async persistBattle(type) {
    this.client.runtime.state.battleSession = this.battle?.snapshot() || null;
    const result = await this.save.commit(this.snapshotForSave(), [{ type, battleId: this.battle?.battleId, phase: this.battle?.state?.phase }]);
    $('#save-status').textContent = result.conflict ? '战斗存档冲突' : `存档 ${this.save.revision}`;
  }
  renderModule(title, description, next) { this.main.innerHTML = `<section class="panel route-card"><div class="eyebrow">WEB MODULE</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><div class="notice">${escapeHtml(next)}</div><div class="actions"><a class="action" href="#/story">回到故事模式</a><a class="action secondary" href="#/home">返回首页</a></div></section>`; }
  renderLoading() { this.main.innerHTML = '<div class="panel route-card"><div class="eyebrow">LOADING</div><h1>载入内容包…</h1><p class="muted">正在读取版本化故事内容和存档。</p></div>'; }
  renderError(title, detail) { this.main.innerHTML = `<section class="panel route-card"><div class="eyebrow">ERROR BOUNDARY</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p><div class="notice error">请确认本地预览服务已启动，并检查浏览器控制台中的错误分类。</div></section>`; }
}

const app = new WebStoryApp();
app.boot();

export { HttpService, SaveService, WebStoryApp };
