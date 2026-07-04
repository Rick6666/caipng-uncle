// 历史最高分：唯一的跨局持久化（只在存活结局更新）。纯函数，不碰 localStorage。
// existing: record | null；result: { score, grade, uncleTitleId }；achievedAt: 时间戳（app.js 传入）
export function recordResult(existing, result, achievedAt) {
  if (existing === null || result.score > existing.score) {
    return { ...result, achievedAt };
  }
  return existing;
}
