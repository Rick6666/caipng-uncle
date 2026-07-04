import { describe, it, expect } from 'vitest';
import { runBatch } from '../src/core/sim.js';

// 平衡回归：数值改动必跑。目标见 docs/02-game-design §11（v1.5：失败是常态）。
describe('balance simulation (7 天口径)', () => {
  const reasonable = runBatch('reasonable', 600);
  const lazy = runBatch('lazy', 600);
  const slasher = runBatch('slasher', 600);

  it('合理策略存活率落在 22%~38%（失败是常态，但好玩家撑得住；bot 为不攒声望的下限）', () => {
    expect(reasonable.survivalRate).toBeGreaterThanOrEqual(0.22);
    expect(reasonable.survivalRate).toBeLessThanOrEqual(0.38);
  });
  it('躺平策略几乎必死（≤13%）', () => {
    expect(lazy.survivalRate).toBeLessThanOrEqual(0.13);
  });
  it('全斩客策略存活率明显低于合理策略（斩客得不偿失）', () => {
    expect(slasher.survivalRate).toBeLessThan(reasonable.survivalRate - 0.05);
  });
  it('CR-08 声望进阶可达：合理策略平均声望不再趴在 0（进度系统未死）', () => {
    expect(reasonable.avgRep).toBeGreaterThan(8);   // 重平衡前恒为 ~0.3
  });
  it('CR-08 斩客几乎攒不到声望（良心经营才涨口碑）', () => {
    expect(slasher.avgRep).toBeLessThan(reasonable.avgRep - 5);
  });
});
