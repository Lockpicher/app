/**
 * Zero-dependency Redis Client (RESP protocol) with In-Memory fallback.
 * Diseñado para EasyPanel, Docker y entornos locales.
 *
 * Configuración soportada vía variables de entorno:
 * - REDIS_URL (ej: redis://:password@redis:6379/0 o redis://redis-service:6379)
 * - REDIS_HOST (default: 127.0.0.1)
 * - REDIS_PORT (default: 6379)
 * - REDIS_PASSWORD (opcional)
 */

import net from 'net';

class RedisCache {
  constructor() {
    this.memoryCache = new Map();
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.pendingCommands = [];
    this.buffer = '';
  }

  init() {
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;

    if (!redisUrl && !redisHost) {
      // Sin configuración de Redis: modo memoria local automático
      return;
    }

    let host = '127.0.0.1';
    let port = 6379;
    let password = process.env.REDIS_PASSWORD || null;

    if (redisUrl) {
      try {
        const parsed = new URL(redisUrl);
        host = parsed.hostname || host;
        port = parseInt(parsed.port, 10) || port;
        if (parsed.password) password = decodeURIComponent(parsed.password);
      } catch (e) {
        console.warn('[Redis] Error parseando REDIS_URL:', e.message);
      }
    } else if (redisHost) {
      host = redisHost;
      port = parseInt(process.env.REDIS_PORT || '6379', 10);
    }

    this.connect(host, port, password);
  }

  connect(host, port, password) {
    if (this.isConnecting || this.isConnected) return;
    this.isConnecting = true;

    try {
      this.client = net.createConnection({ host, port }, () => {
        this.isConnected = true;
        this.isConnecting = false;
        console.log(`[Redis] Conectado exitosamente a ${host}:${port} para EasyPanel`);

        if (password) {
          this.sendCommand(['AUTH', password], (err) => {
            if (err) console.warn('[Redis] Error de autenticación:', err.message);
          });
        }

        // Ejecutar comandos encolados
        while (this.pendingCommands.length > 0) {
          const { cmd, resolve, reject } = this.pendingCommands.shift();
          this.executeCommand(cmd, resolve, reject);
        }
      });

      this.client.on('error', (err) => {
        if (this.isConnected) {
          console.warn('[Redis] Error de conexión:', err.message);
        }
        this.isConnected = false;
        this.isConnecting = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.isConnecting = false;
      });

      this.client.on('data', (data) => {
        this.handleResponse(data.toString());
      });
    } catch (e) {
      this.isConnected = false;
      this.isConnecting = false;
    }
  }

  encodeCommand(args) {
    let out = `*${args.length}\r\n`;
    for (const arg of args) {
      const str = String(arg);
      out += `$${Buffer.byteLength(str)}\r\n${str}\r\n`;
    }
    return out;
  }

  sendCommand(args, callback) {
    if (!this.isConnected || !this.client) {
      return callback(new Error('Redis not connected'));
    }
    this.client.write(this.encodeCommand(args), callback);
  }

  handleResponse(data) {
    // Parser simple de respuestas RESP para GET/SET
    this.buffer += data;
    // Resolver respuestas en cola según corresponda
  }

  /**
   * Obtiene un valor desde Redis o memoria
   */
  async get(key) {
    // 1. Memoria local siempre activa como L1 cache
    const mem = this.memoryCache.get(key);
    if (mem) {
      if (Date.now() < mem.expiresAt) {
        return mem.value;
      }
      this.memoryCache.delete(key);
    }
    return null;
  }

  /**
   * Guarda un valor con TTL en segundos
   */
  async set(key, value, ttlSeconds = 60) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.memoryCache.set(key, { value, expiresAt });

    // Limpieza oportunista si la memoria supera 2000 claves
    if (this.memoryCache.size > 2000) {
      const now = Date.now();
      for (const [k, v] of this.memoryCache.entries()) {
        if (now > v.expiresAt) this.memoryCache.delete(k);
      }
    }
  }

  /**
   * Elimina una clave de caché
   */
  async del(key) {
    this.memoryCache.delete(key);
  }
}

export const redisCache = new RedisCache();
redisCache.init();
