// 极简 DOM 工具：建元素、飘字、HUD、区块渲染。UI 层不含任何数值规则。
import { repLevel } from '../core/state.js';
import { REP_LEVELS } from '../core/data.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

// 菜品/顾客图标：本作采用 emoji 视觉，不加载外部美术资产（避免 404、零网络依赖）
export function pic(emoji, cls) {
  return h('span', { class: cls }, emoji);
}

let toastLayer;
export function toast(msg) {
  toastLayer = toastLayer || document.getElementById('toast-layer');
  const t = h('div', { class: 'toast' }, msg);
  toastLayer.append(t);
  setTimeout(() => t.remove(), 1600);
}

export function renderHud(state) {
  const hud = document.getElementById('hud');
  const wrap = document.getElementById('rep-bar-wrap');
  if (state.phase === 'title' || state.phase === 'ending' || state.phase === 'gameover') {
    hud.classList.add('hidden'); wrap.classList.add('hidden');
    return;
  }
  hud.classList.remove('hidden'); wrap.classList.remove('hidden');
  document.getElementById('hud-day').textContent = `☀️ 第 ${state.day}/7 天`;
  document.getElementById('hud-money').textContent = `💰 $${state.money}`;
  document.getElementById('hud-rep').textContent = `⭐ ${state.rep}`;
  const lvl = repLevel(state.rep);
  document.getElementById('rep-title').textContent = lvl.title;
  // 进度条：当前档到下一档的百分比
  const next = REP_LEVELS[lvl.index + 1];
  const pct = next ? Math.min(100, Math.round((state.rep - lvl.threshold) / (next.threshold - lvl.threshold) * 100)) : 100;
  document.getElementById('rep-bar-fill').style.width = pct + '%';
}

export function setScreen(...nodes) {
  const scr = document.getElementById('screen');
  scr.replaceChildren(...nodes.flat().filter(Boolean));
  scr.scrollTop = 0;
}
export function setActions(...nodes) {
  document.getElementById('actions').replaceChildren(...nodes.flat().filter(Boolean));
}

// 通用大按钮
export function btn(label, cls, onClick, sub, disabled) {
  const children = [label];
  if (sub) children.push(h('span', { class: 'btn-sub' }, sub));
  return h('button', { class: `btn ${cls}`, onClick, disabled: disabled || false }, ...children);
}
