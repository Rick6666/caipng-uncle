import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng.js';

describe('rng', () => {
  it('同种子序列完全一致', () => {
    const a = createRng(42), b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('getState 后可无缝续接', () => {
    const a = createRng(7);
    a.next(); a.next();
    const b = createRng(a.getState());
    expect(b.next()).toBe(a.next());
  });
  it('int 含两端且分布合理', () => {
    const r = createRng(1), seen = new Set();
    let c1 = 0;
    for (let i = 0; i < 10000; i++) { const v = r.int(1, 3); seen.add(v); if (v === 1) c1++; }
    expect([...seen].sort()).toEqual([1, 2, 3]);
    expect(c1 / 10000).toBeGreaterThan(0.2);
  });
  it('weighted 按权重抽取，权重 0 永不出现', () => {
    const r = createRng(9);
    const items = [{ id: 'a', weight: 9 }, { id: 'b', weight: 1 }, { id: 'c', weight: 0 }];
    let a = 0;
    for (let i = 0; i < 10000; i++) { const p = r.weighted(items); if (p.id === 'a') a++; expect(p.id).not.toBe('c'); }
    expect(a / 10000).toBeGreaterThan(0.85);
    expect(a / 10000).toBeLessThan(0.95);
  });
  it('chance 概率边界', () => {
    const r = createRng(3);
    expect(r.chance(1)).toBe(true);
    expect(r.chance(0)).toBe(false);
  });
  it('pick 返回数组内元素', () => {
    const r = createRng(5), arr = ['x', 'y', 'z'];
    for (let i = 0; i < 50; i++) expect(arr).toContain(r.pick(arr));
  });
});
