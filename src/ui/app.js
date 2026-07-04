// 入口：持有唯一 state，dispatch = reduce + render。持久化仅历史最高分（存活结局时）。
import { newGame, finalScore, grade, uncleTitle } from '../core/state.js';
import { reduce } from '../core/day.js';
import { recordResult } from '../core/highscore.js';
import { render } from './screens.js';
import { renderHud, toast, freshSeed } from './dom.js';

const HS_KEY = 'caipng.highscore';

function loadHighscore() {
  try {
    const raw = localStorage.getItem(HS_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw);
    if (r && typeof r.score === 'number' && typeof r.grade === 'string') return r;
    return null;
  } catch { return null; }
}
function saveHighscore(r) {
  try { localStorage.setItem(HS_KEY, JSON.stringify(r)); } catch { /* 无痕模式忽略 */ }
}

let highscore = loadHighscore();
let state;

// E-1：历史最高分作为渲染参数传入，不写进 state（state 只应由 reducer 产出/UI 只读）
function draw(displayHighscore) { render(state, dispatch, displayHighscore); renderHud(state); }

function dispatch(action) {
  const prev = state;
  state = reduce(state, action);
  let displayHighscore = highscore;
  if (state.phase === 'ending' && prev.phase !== 'ending') {
    const sc = finalScore(state);
    const result = { score: sc, grade: grade(sc), uncleTitleId: uncleTitle(state.stats, state.rep, state.money).id };
    displayHighscore = highscore;   // 展示时对比进入结局前的旧纪录
    highscore = recordResult(highscore, result, Date.now());
    saveHighscore(highscore);
  }
  draw(displayHighscore);
}

// 顶层兜底：先于首次 draw() 注册，首屏渲染抛错也能兜住（E-4c）
window.addEventListener('error', () => toast('Uncle 打了个盹，刷新一下试试'));

// 初始化：?seed= 覆盖初始种子（测试/分享用），非法值（非数字）时回退随机种子，而非静默变成 0（E-4b）
const seedParam = new URLSearchParams(location.search).get('seed');
const parsedSeed = seedParam != null && seedParam !== '' ? Number(seedParam) : NaN;
const initialSeed = Number.isFinite(parsedSeed) ? (parsedSeed >>> 0) : freshSeed();
state = newGame(initialSeed);
draw(highscore);

// 误触退出拦截：游戏进行中弹系统确认框
window.addEventListener('beforeunload', (e) => {
  if (!['title', 'ending', 'gameover'].includes(state.phase)) {
    e.preventDefault();
    e.returnValue = '';
  }
});
