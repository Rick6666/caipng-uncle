// 入口：持有唯一 state，dispatch = reduce + render。持久化仅历史最高分（存活结局时）。
import { newGame, finalScore, grade, uncleTitle } from '../core/state.js';
import { reduce } from '../core/day.js';
import { recordResult } from '../core/highscore.js';
import { render } from './screens.js';
import { renderHud, toast } from './dom.js';

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

function draw() { render(state, dispatch); renderHud(state); }

function dispatch(action) {
  const prev = state;
  state = reduce(state, action);
  if (state.phase === 'ending' && prev.phase !== 'ending') {
    const sc = finalScore(state);
    const result = { score: sc, grade: grade(sc), uncleTitleId: uncleTitle(state.stats, state.rep, state.money).id };
    const before = highscore;
    highscore = recordResult(highscore, result, Date.now());
    saveHighscore(highscore);
    state._highscore = before;      // 展示时对比进入结局前的旧纪录
  } else {
    state._highscore = highscore;
  }
  draw();
}

function freshSeed() {
  return (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
}

// 初始化：?seed= 覆盖初始种子（测试/分享用），否则随机
const seedParam = new URLSearchParams(location.search).get('seed');
const initialSeed = seedParam != null && seedParam !== '' ? (Number(seedParam) >>> 0) : freshSeed();
state = newGame(initialSeed);
state._highscore = highscore;
draw();

// 误触退出拦截：游戏进行中弹系统确认框
window.addEventListener('beforeunload', (e) => {
  if (!['title', 'ending', 'gameover'].includes(state.phase)) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// 顶层兜底
window.addEventListener('error', () => toast('Uncle 打了个盹，刷新一下试试'));
