/**
 * 缓存工具
 * 当前使用内存缓存（Map），后期可替换为 Redis
 */

const cache = new Map<string, { data: unknown; expires: number }>();

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now > value.expires) {
      cache.delete(key);
    }
  }
}, 60_000); // 每分钟清理一次

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);

  // 命中缓存且未过期
  if (cached && now < cached.expires) {
    return cached.data as T;
  }

  // 缓存未命中，调接口
  const data = await fetcher();

  // 写入缓存
  cache.set(key, {
    data,
    expires: now + ttlSeconds * 1000,
  });

  return data;
}

export function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
