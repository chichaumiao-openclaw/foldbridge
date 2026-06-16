// RMDB→PDB case 语料构造纯函数库（build-time，无 fs 依赖，便于单测）。

/**
 * 解析 TSV 文本为 header 键控的对象数组。
 * - 制表符分隔，首行为表头
 * - 容忍结尾换行
 * - 保留空的尾随字段（用表头长度补齐）
 */
export function parseTsv(text) {
  const lines = String(text).split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const row = {};
    header.forEach((key, i) => { row[key] = cells[i] ?? ''; });
    return row;
  });
}
