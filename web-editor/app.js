import { loadStoryPackage, indexStoryPackage } from '../web-runtime/content-loader.mjs';

let content;
let selectedId = '';
const undoStack = [];
const redoStack = [];
const DRAFT_KEY = 'jjk-story-workbench-draft-v1';
const $ = (id) => document.getElementById(id);
const clone = (value) => structuredClone(value);
const nodeList = $('node-list');

function showMessage(message, good = true) { $('form-message').textContent = message; $('form-message').style.color = good ? 'var(--ok)' : 'var(--danger)'; }
function choicesFor(node) { return Array.isArray(node.choices) ? node.choices : Array.isArray(node.choiceSet) ? node.choiceSet : []; }
function lineText(lines = []) { return lines.map((line) => `${line.speaker || '旁白'}：${line.text || ''}`).join('\n'); }
function parseLines(value) {
  return String(value || '').split(/\r?\n/).map((raw) => raw.trim()).filter(Boolean).map((raw) => {
    const match = raw.match(/^([^：:]{1,30})[：:]\s*(.*)$/);
    return match ? { speaker: match[1].trim(), text: match[2].trim() } : { speaker: '旁白', text: raw };
  }).filter((line) => line.text);
}
function referencesOf(node) {
  return [node.next, ...choicesFor(node).map((choice) => choice.next), ...Object.values(node.nextNodes || {}), ...Object.values(node.completionRoutes || {}), ...Object.values(node.outcomes || {})].filter(Boolean);
}
function visibleNodes() {
  const query = $('search').value.trim().toLowerCase();
  return Object.values(content.nodes).filter((node) => !query || `${node.id} ${node.title} ${node.type} ${lineText(node.rpgLines)}`.toLowerCase().includes(query));
}
function renderList() {
  nodeList.replaceChildren();
  for (const node of visibleNodes()) {
    const item = document.createElement('div'); item.className = `node-item${node.id === selectedId ? ' active' : ''}`; item.dataset.id = node.id;
    item.innerHTML = '<span class="node-name"></span><span class="node-meta"></span>';
    item.querySelector('.node-name').textContent = node.title || node.id;
    item.querySelector('.node-meta').textContent = `${node.type} · ${node.id}`;
    item.addEventListener('click', () => selectNode(node.id)); nodeList.append(item);
  }
}
function renderReferences() {
  const node = content?.nodes?.[selectedId]; if (!node) return;
  const incoming = Object.values(content.nodes).filter((candidate) => referencesOf(candidate).includes(node.id)).map((candidate) => `${candidate.title || candidate.id} (${candidate.id})`);
  const outgoing = referencesOf(node).map((id) => `${content.nodes[id]?.title || '缺失节点'} (${id})`);
  $('references').textContent = `引用此节点：${incoming.length ? incoming.join('、') : '无上游引用'}\n此节点出口：${outgoing.length ? outgoing.join('、') : '无出口'}`;
}
function selectNode(id) {
  selectedId = id; const node = content.nodes[id]; if (!node) return;
  $('empty-state').hidden = true; $('node-form').hidden = false;
  $('node-id').value = node.id; $('node-type').value = node.type; $('node-title').value = node.title || '';
  $('node-speaker').value = node.speakerId || ''; $('node-next').value = node.next || '';
  $('node-dialogue').value = node.dialogue || node.text || node.summary || '';
  $('node-rpg-lines').value = lineText(node.rpgLines || []);
  const background = node.backgroundSequence || node.background || node.backgrounds || '';
  $('node-background').value = Array.isArray(background) ? background.join('\n') : typeof background === 'object' ? JSON.stringify(background, null, 2) : String(background || '');
  $('node-choices').value = JSON.stringify(choicesFor(node), null, 2); $('node-notes').value = node.editorNotes || '';
  $('node-conditions').value = JSON.stringify(node.conditions || { requiresFlags: node.requiresFlags || [], excludesFlags: node.excludesFlags || [], minResources: node.minResources || {} }, null, 2);
  $('node-effects').value = JSON.stringify({ resources: node.resources || {}, growth: node.growth || {}, relationshipDelta: node.relationshipDelta || {}, storyFlags: node.storyFlags || {} }, null, 2);
  $('node-encounter').value = node.encounterId || ''; $('node-ai-policy').value = [node.fallbackSetId || '', node.effectPolicyId || ''].filter(Boolean).join(' · ');
  renderList(); renderPreview(); renderReferences(); showMessage('');
}
function renderPreview() {
  const node = content?.nodes?.[selectedId]; if (!node) return;
  const preview = $('preview'); preview.replaceChildren();
  const kicker = document.createElement('div'); kicker.className = 'preview-kicker'; kicker.textContent = `${node.type.toUpperCase()} · ${node.id}`; preview.append(kicker);
  const title = document.createElement('h2'); title.textContent = node.title || node.id; preview.append(title);
  const narrative = node.dialogue || node.text || node.summary;
  if (narrative) { const paragraph = document.createElement('p'); paragraph.textContent = narrative; preview.append(paragraph); }
  for (const entry of node.rpgLines || []) { const line = document.createElement('div'); line.className = 'preview-line'; const speaker = document.createElement('strong'); speaker.textContent = entry.speaker || '旁白'; line.append(speaker, document.createTextNode(entry.text || '')); preview.append(line); }
  if (!narrative && !(node.rpgLines || []).length) { const paragraph = document.createElement('p'); paragraph.textContent = '（此节点由运行时组件接管）'; preview.append(paragraph); }
  for (const choice of choicesFor(node)) { const line = document.createElement('div'); line.className = 'preview-choice'; line.textContent = `› ${choice.label || choice.value || choice.id}`; preview.append(line); }
}
function renderDiagnostics(report, prefix = '本地校验') {
  const errors = report.errors || []; const warnings = report.warnings || []; const box = $('diagnostics'); box.replaceChildren();
  const summary = document.createElement('div'); summary.className = `diagnostic ${errors.length ? 'error' : 'ok'}`; summary.textContent = `${prefix}：${errors.length} 个错误，${warnings.length} 个警告`; box.append(summary);
  for (const item of errors) { const line = document.createElement('div'); line.className = 'diagnostic error'; line.textContent = `错误：${item.message || item}`; box.append(line); }
  for (const item of warnings) { const line = document.createElement('div'); line.className = 'diagnostic warning'; line.textContent = `警告：${item.message || item}`; box.append(line); }
}
function localValidation() {
  const errors = []; const warnings = []; const ids = new Set(Object.keys(content.nodes));
  if (content.schemaVersion !== 'story-package.v1') errors.push({ message: 'schemaVersion 不正确' });
  if (!ids.has(content.project?.entryNodeId)) errors.push({ message: `入口节点不存在：${content.project?.entryNodeId}` });
  for (const node of Object.values(content.nodes)) {
    for (const target of referencesOf(node)) if (!ids.has(target)) errors.push({ message: `${node.id} 引用了不存在的节点 ${target}` });
    if (node.type === 'battle' && !node.encounterId) errors.push({ message: `${node.id} 缺少 encounterId` });
    if (node.type === 'ai_dialogue' && (!node.speakerId || !node.fallbackSetId || !node.effectPolicyId)) errors.push({ message: `${node.id} 的 AI 配置不完整` });
    if (node.type !== 'end' && !referencesOf(node).length && !['command', 'presentation'].includes(node.type)) warnings.push({ message: `${node.id} 没有出口` });
  }
  return { errors, warnings };
}
async function runValidation() {
  renderDiagnostics(localValidation());
  try {
    const response = await fetch('/api/story/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ package: content }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json(); renderDiagnostics(payload.report || {}, '服务端校验');
  } catch (error) { renderDiagnostics({ errors: [{ message: `服务端不可用：${error.message}` }], warnings: [] }, '服务端校验'); }
}
function updateHistoryButtons() { $('undo').disabled = !undoStack.length; $('redo').disabled = !redoStack.length; }
function remember() { undoStack.push(clone(content)); if (undoStack.length > 50) undoStack.shift(); redoStack.length = 0; updateHistoryButtons(); }
function persistDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(content)); } catch { /* Browser storage may be disabled. */ } }
function restore(snapshot) { content = indexStoryPackage(clone(snapshot)); selectNode(content.nodes[selectedId] ? selectedId : content.project.entryNodeId); persistDraft(); }
function undo() { if (!undoStack.length) return; redoStack.push(clone(content)); restore(undoStack.pop()); updateHistoryButtons(); showMessage('已撤销上一次节点修改'); }
function redo() { if (!redoStack.length) return; undoStack.push(clone(content)); restore(redoStack.pop()); updateHistoryButtons(); showMessage('已重做节点修改'); }
function saveNode(event) {
  event.preventDefault(); const node = content.nodes[selectedId]; if (!node) return;
  let choices; let conditions; let effects;
  try { choices = JSON.parse($('node-choices').value || '[]'); if (!Array.isArray(choices)) throw new Error('选项必须是数组'); conditions = JSON.parse($('node-conditions').value || '{}'); effects = JSON.parse($('node-effects').value || '{}'); } catch (error) { showMessage(`JSON 无效：${error.message}`, false); return; }
  remember();
  node.title = $('node-title').value.trim(); node.editorNotes = $('node-notes').value.trim(); node.rpgLines = parseLines($('node-rpg-lines').value);
  node.speakerId = $('node-speaker').value.trim() || undefined; node.next = $('node-next').value.trim() || undefined; node.conditions = conditions;
  if (node.legacyType === 'rpg' || node.type === 'dialogue') node.dialogue = $('node-dialogue').value;
  if (Array.isArray(node.choices)) node.choices = choices; else if (Array.isArray(node.choiceSet)) node.choiceSet = choices; else node.choices = choices;
  for (const key of ['resources', 'growth', 'relationshipDelta', 'storyFlags']) if (effects[key] !== undefined) node[key] = effects[key];
  node.encounterId = $('node-encounter').value.trim() || node.encounterId;
  const aiPolicy = $('node-ai-policy').value.split('·').map((value) => value.trim()).filter(Boolean); if (aiPolicy[0]) node.fallbackSetId = aiPolicy[0]; if (aiPolicy[1]) node.effectPolicyId = aiPolicy[1];
  const rawBackground = $('node-background').value.trim(); if (rawBackground.includes('\n')) node.backgroundSequence = rawBackground.split(/\r?\n/).map((item) => item.trim()).filter(Boolean); else if (rawBackground) node.background = rawBackground;
  persistDraft(); showMessage('节点草稿已保存到本浏览器（尚未发布）'); renderList(); renderPreview(); renderReferences(); renderDiagnostics(localValidation());
}
function download() { const blob = new Blob([`${JSON.stringify(content, null, 2)}\n`], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${content.project?.id || 'story'}-${content.contentVersion || 'draft'}.json`; link.click(); URL.revokeObjectURL(link.href); }
async function boot() {
  const base = indexStoryPackage(await loadStoryPackage('./story-package.json'));
  try { content = indexStoryPackage(JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') || base); } catch { content = base; }
  $('package-meta').textContent = `${content.contentVersion} · ${Object.keys(content.nodes).length} 节点 · 本地草稿`;
  $('search').addEventListener('input', renderList); $('node-form').addEventListener('submit', saveNode); $('validate').addEventListener('click', runValidation); $('download').addEventListener('click', download); $('preview-node').addEventListener('click', renderPreview); $('undo').addEventListener('click', undo); $('redo').addEventListener('click', redo);
  renderList(); selectNode(content.project.entryNodeId); renderDiagnostics(localValidation());
}
boot().catch((error) => { $('package-meta').textContent = '加载失败'; $('diagnostics').innerHTML = `<div class="diagnostic error">无法加载内容包：${error.message}</div>`; });
