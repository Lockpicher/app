/**
 * OpenTelemetry-compatible Performance Tracer & Metrics Tracker
 * Monitorea latencias de red, llamadas a la API y detecta peticiones lentas (>500ms).
 */

export interface TraceSpan {
  id: string;
  name: string;
  startTime: number;
  duration?: number;
  metadata?: Record<string, any>;
  isSlow?: boolean;
}

class PerformanceTracer {
  private activeSpans = new Map<string, TraceSpan>();
  private slowSpans: TraceSpan[] = [];
  private slowThresholdMs = 500; // Alerta de petición lenta si supera 500ms

  /**
   * Genera un traceparent W3C compatible para trazabilidad distribuida
   */
  generateTraceparent(): string {
    const version = '00';
    const traceId = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const parentId = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const traceFlags = '01'; // sampled
    return `${version}-${traceId}-${parentId}-${traceFlags}`;
  }

  /**
   * Inicia un span de medición
   */
  startSpan(name: string, metadata?: Record<string, any>): string {
    const id = `span_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const span: TraceSpan = {
      id,
      name,
      startTime: performance.now(),
      metadata
    };
    this.activeSpans.set(id, span);
    return id;
  }

  /**
   * Finaliza el span y registra si fue lento
   */
  endSpan(id: string, additionalMetadata?: Record<string, any>): TraceSpan | null {
    const span = this.activeSpans.get(id);
    if (!span) return null;

    const endTime = performance.now();
    span.duration = Math.round((endTime - span.startTime) * 100) / 100;
    if (additionalMetadata) {
      span.metadata = { ...(span.metadata || {}), ...additionalMetadata };
    }

    if (span.duration > this.slowThresholdMs) {
      span.isSlow = true;
      this.slowSpans.push(span);
      if (this.slowSpans.length > 50) this.slowSpans.shift(); // Mantener últimos 50
      console.warn(`[OpenTelemetry] ⚠️ Petición Lenta detectada: '${span.name}' tardó ${span.duration}ms`, span.metadata);
    }

    this.activeSpans.delete(id);
    return span;
  }

  /**
   * Envuelve una función asíncrona registrando automáticamente su duración
   */
  async traceAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const spanId = this.startSpan(name, metadata);
    try {
      const result = await fn();
      this.endSpan(spanId, { status: 'success' });
      return result;
    } catch (error: any) {
      this.endSpan(spanId, { status: 'error', error: error?.message });
      throw error;
    }
  }

  getSlowRequests(): TraceSpan[] {
    return [...this.slowSpans];
  }
}

export const tracer = new PerformanceTracer();
