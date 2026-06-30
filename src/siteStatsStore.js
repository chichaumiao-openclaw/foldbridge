// siteStatsStore.js — 浏览器侧站点全局统计资产加载层。
// 与 probingArticleStore 同构：相对路径基址 + 内存缓存，避免重复 fetch。
// stats.json 由 scripts/build-site-stats.mjs 在构建期生成。
// 失败返回 null（绝不抛错），让 Stats 页降级为最小壳而非白屏。

export const DEFAULT_ASSET_BASE = './src/assets/generated/site-stats';

/**
 * 创建站点统计资产 store。
 * @param {object} [opts]
 * @param {string} [opts.assetBase] 生成资产根路径（默认相对路径）
 * @param {Function} [opts.fetchImpl] 注入的 fetch（测试用）；默认全局 fetch
 */
export function createSiteStatsStore({ assetBase = DEFAULT_ASSET_BASE, fetchImpl } = {}) {
  const doFetch = fetchImpl || ((...args) => fetch(...args));
  let cached;

  return {
    async loadStats() {
      if (cached !== undefined) return cached;
      const url = `${assetBase}/stats.json`;
      try {
        const res = await doFetch(url);
        if (!res || !res.ok) {
          cached = null;
          return cached;
        }
        cached = await res.json();
      } catch (_err) {
        cached = null;
      }
      return cached;
    },
    // 同步缓存读取（供同步渲染路径命中已加载资产）；未加载时 undefined。
    peek() {
      return cached;
    }
  };
}
