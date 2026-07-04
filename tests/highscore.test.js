import { describe, it, expect } from 'vitest';
import { recordResult } from '../src/core/highscore.js';

describe('highscore', () => {
  it('首次记录必定生效', () => {
    const result = { score: 300, grade: 'A', uncleTitleId: 'worldly' };
    expect(recordResult(null, result, 1000)).toEqual({ ...result, achievedAt: 1000 });
  });
  it('刷新纪录：新分数更高才覆盖', () => {
    const existing = { score: 300, grade: 'A', uncleTitleId: 'worldly', achievedAt: 1000 };
    const better = { score: 400, grade: 'S', uncleTitleId: 'kind' };
    expect(recordResult(existing, better, 2000)).toEqual({ ...better, achievedAt: 2000 });
  });
  it('新分数不如旧纪录，原样返回同一引用', () => {
    const existing = { score: 300, grade: 'A', uncleTitleId: 'worldly', achievedAt: 1000 };
    const worse = { score: 250, grade: 'B', uncleTitleId: 'broke' };
    expect(recordResult(existing, worse, 2000)).toBe(existing);
  });
  it('纯函数：相同输入输出深度相等', () => {
    const r = { score: 100, grade: 'C', uncleTitleId: 'broke' };
    expect(recordResult(null, r, 5)).toEqual(recordResult(null, r, 5));
  });
});
