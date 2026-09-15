import type { Transferable } from 'node:worker_threads';

export interface PiscinaTaskOptions {
  workerPath: string;
  workerName?: string;
  timeoutMs?: number;
  transferList?: readonly Transferable[];
}
