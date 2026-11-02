/**
 * API Request Deduplicator & Memory Cache (SWR-like)
 * Evita llamadas duplicadas en vuelo y proporciona caché en memoria con invalidación inteligente.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class ApiCache {
  private inFlight = new Map<string, Promise<any>>();
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTtl = 45 * 1000; // 45 segundos de caché en memoria para lecturas

  /**
   * Ejecuta una petición deduplicando llamadas idénticas concurrentes
   * y cacheando la respuesta temporalmente.
   */
  async dedupe<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { ttlMs?: number; forceFresh?: boolean } = {}
  ): Promise<T> {
    const { ttlMs = this.defaultTtl, forceFresh = false } = options;

    // 1. Si no se fuerza refresco y existe caché vigente, devolver inmediatamente
    if (!forceFresh) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < ttlMs) {
        return cached.data;
      }
    }

    // 2. Si ya hay una petición idéntica en vuelo, devolver la misma promesa
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key) as Promise<T>;
    }

    // 3. Iniciar la petición y registrarla en vuelo
    const promise = (async () => {
      try {
        const result = await fetcher();
        this.cache.set(key, { data: result, timestamp: Date.now() });
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Invalida una clave específica o todas las claves que comiencen con un prefijo
   */
  invalidate(keyOrPrefix: string) {
    for (const k of this.cache.keys()) {
      if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) {
        this.cache.delete(k);
      }
    }
  }

  /**
   * Limpia toda la memoria de caché
   */
  clear() {
    this.cache.clear();
    this.inFlight.clear();
  }
}

export const apiCache = new ApiCache();
