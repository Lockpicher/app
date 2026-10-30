import type { IncomingMessage, ServerResponse } from 'http';

export interface AuthSuccess {
  ok: true;
  user: any;
}

export interface AuthFailure {
  ok: false;
  status: number;
  error: string;
}

export type AuthResult = AuthSuccess | AuthFailure;

export interface RateLimiter {
  (ip: string): boolean;
  getRetryAfter(ip: string): number;
  retryAfter(ip: string): number;
  reset(): void;
}

export function sendJson(
  res: ServerResponse,
  status: number,
  data: any,
  extraHeaders?: Record<string, string | number | undefined>
): void;

export function readBodyWithLimit(
  req: IncomingMessage,
  maxBytes: number,
  optionalRes?: ServerResponse | null
): Promise<{ buffer: Buffer | null; tooLarge: boolean; error?: any }>;

export function parseJsonSafe<T = any>(buffer: Buffer | string | null | undefined, maxBytes?: number | null): T | null;

export function getClientIp(req: IncomingMessage): string;

export function createRateLimiter(options: { windowMs: number; max: number }): RateLimiter;

export function authenticateRequest(
  req?: IncomingMessage | null,
  opts?: { token?: string; baseUrl?: string; timeoutMs?: number }
): Promise<AuthResult>;

declare global {
  interface ImportMetaEnv {
    VITE_INSFORGE_ANON_KEY?: string;
    [key: string]: any;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

declare module './apiGuard.mjs' {
  export function sendJson(
    res: ServerResponse,
    status: number,
    data: any,
    extraHeaders?: Record<string, string | number | undefined>
  ): void;

  export function readBodyWithLimit(
    req: IncomingMessage,
    maxBytes: number,
    optionalRes?: ServerResponse | null
  ): Promise<{ buffer: Buffer | null; tooLarge: boolean; error?: any }>;

  export function parseJsonSafe<T = any>(buffer: Buffer | string | null | undefined, maxBytes?: number | null): T | null;

  export function getClientIp(req: IncomingMessage): string;

  export function createRateLimiter(options: { windowMs: number; max: number }): RateLimiter;

  export function authenticateRequest(
    req?: IncomingMessage | null,
    opts?: { token?: string; baseUrl?: string; timeoutMs?: number }
  ): Promise<AuthResult>;
}
