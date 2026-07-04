// 大规模种子归档 + 难度数据分析。输出 CSV 到 docs/analysis/，并打印聚合分析。
import { runGame } from '../../src/core/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('.', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const STRATS = ['reasonable', 'lazy', 'slasher'];
const N = 5000;

const gameRows = [['strategy', 'seed', 'survived', 'endDay', 'money', 'rep', 'score', 'grade', 'outcomeId']];
const dayRows = [['strategy', 'seed', 'day', 'money', 'rep', 'revenue', 'spend', 'profit', 'dead']];

// 聚合容器
const agg = {};
for (const s of STRATS) agg[s] = {
  n: 0, survived: 0, deathByDay: {}, gradeDist: {}, outcomeDist: {},
  repBuckets: { '0': 0, '1-14': 0, '15-29': 0, '30-54': 0, '55-84': 0, '85+': 0 },
  scoreSum: 0, scoreN: 0, repPeakSum: 0,
  dayProfit: {}, // day -> [profit...] 中位用
};

function repBucket(r) {
  if (r <= 0) return '0'; if (r < 15) return '1-14'; if (r < 30) return '15-29';
  if (r < 55) return '30-54'; if (r < 85) return '55-84'; return '85+';
}

for (const strat of STRATS) {
  const a = agg[strat];
  for (let seed = 0; seed < N; seed++) {
    const trace = [];
    const r = runGame(strat, seed, t => trace.push(t));
    a.n++;
    // 逐日
    let peak = 0;
    for (const t of trace) {
      const profit = (t.revenue || 0) - (t.spend || 0);
      dayRows.push([strat, seed, t.day, t.money, t.rep, t.revenue || 0, t.spend || 0, profit, t.dead ? 1 : 0]);
      (a.dayProfit[t.day] ||= []).push(profit);
      peak = Math.max(peak, t.rep);
    }
    peak = Math.max(peak, r.rep);
    a.repPeakSum += peak;
    const outcomeId = r.survived ? r.titleId : r.epitaphId;
    gameRows.push([strat, seed, r.survived ? 1 : 0, r.day, r.money, r.rep, r.score, r.grade, outcomeId]);
    if (r.survived) {
      a.survived++; a.scoreSum += r.score; a.scoreN++;
      a.gradeDist[r.grade] = (a.gradeDist[r.grade] || 0) + 1;
      a.repBuckets[repBucket(r.rep)]++;
    } else {
      a.deathByDay[r.day] = (a.deathByDay[r.day] || 0) + 1;
    }
    a.outcomeDist[outcomeId] = (a.outcomeDist[outcomeId] || 0) + 1;
  }
}

// 写 CSV
const toCsv = rows => rows.map(r => r.join(',')).join('\n');
writeFileSync(`${OUT}/games.csv`, toCsv(gameRows));
writeFileSync(`${OUT}/daily.csv`, toCsv(dayRows));

// 中位数
const median = arr => { const s = [...arr].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// 打印分析
const summary = {};
for (const strat of STRATS) {
  const a = agg[strat];
  const dayProfitMed = {};
  for (let d = 1; d <= 7; d++) dayProfitMed[d] = a.dayProfit[d] ? median(a.dayProfit[d]) : null;
  summary[strat] = {
    n: a.n,
    survivalPct: +(a.survived / a.n * 100).toFixed(1),
    avgScoreSurvived: a.scoreN ? Math.round(a.scoreSum / a.scoreN) : 0,
    avgRepPeak: +(a.repPeakSum / a.n).toFixed(1),
    deathByDay: a.deathByDay,
    gradeDist: a.gradeDist,
    repBuckets: a.repBuckets,
    outcomeDist: a.outcomeDist,
    dayProfitMedian: dayProfitMed
  };
}
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));

// 控制台友好输出
for (const strat of STRATS) {
  const s = summary[strat];
  console.log(`\n=== ${strat} (N=${s.n}) ===`);
  console.log(`存活率 ${s.survivalPct}% | 存活均分 ${s.avgScoreSurvived} | 历史最高rep均值 ${s.avgRepPeak}`);
  const dbd = Array.from({ length: 7 }, (_, i) => `D${i + 1}:${s.deathByDay[i + 1] || 0}`).join(' ');
  console.log(`死亡日分布  ${dbd}  存活:${s.survivalPct}%`);
  console.log(`逐日利润中位 ${Array.from({ length: 7 }, (_, i) => `D${i + 1}:${s.dayProfitMedian[i + 1]}`).join(' ')}`);
  if (Object.keys(s.gradeDist).length) console.log(`存活评级  ${JSON.stringify(s.gradeDist)}`);
  console.log(`存活声望档 ${JSON.stringify(s.repBuckets)}`);
}
console.log(`\n✅ 已归档: docs/analysis/games.csv (${gameRows.length - 1} 局), daily.csv (${dayRows.length - 1} 天), summary.json`);
