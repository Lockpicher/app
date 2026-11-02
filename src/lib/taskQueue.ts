/**
 * Background Task Queue
 * Ejecuta tareas secundarias o no bloqueantes durante períodos de inactividad del navegador (requestIdleCallback).
 */

type TaskFn = () => Promise<void> | void;

interface QueuedTask {
  id: string;
  name: string;
  task: TaskFn;
  retries: number;
}

class BackgroundTaskQueue {
  private queue: QueuedTask[] = [];
  private isProcessing = false;
  private maxRetries = 2;

  /**
   * Encola una tarea para ejecución en segundo plano sin bloquear la UI
   */
  enqueue(name: string, task: TaskFn): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.queue.push({ id, name, task, retries: 0 });
    this.scheduleNext();
    return id;
  }

  private scheduleNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback((deadline) => {
        this.processBatch(deadline);
      }, { timeout: 2000 });
    } else {
      setTimeout(() => {
        this.processBatch();
      }, 50);
    }
  }

  private async processBatch(deadline?: IdleDeadline) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        // Si el navegador necesita el hilo para renderizar, ceder el control
        if (deadline && deadline.timeRemaining() < 5 && !deadline.didTimeout) {
          break;
        }

        const item = this.queue.shift();
        if (!item) break;

        try {
          await item.task();
        } catch (err) {
          console.warn(`[TaskQueue] Tarea '${item.name}' falló:`, err);
          if (item.retries < this.maxRetries) {
            item.retries++;
            this.queue.push(item);
          }
        }
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        this.scheduleNext();
      }
    }
  }

  getPendingCount(): number {
    return this.queue.length;
  }
}

export const taskQueue = new BackgroundTaskQueue();
