import type { Response } from 'express';

export const SSE_HEARTBEAT_MS = 25_000;

export function prepareSseResponse(response: Response): void {
  response.status(200);
  response.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control':
      'private, no-cache, no-store, must-revalidate, max-age=0, no-transform',
    Connection: 'keep-alive',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Accel-Buffering': 'no',
  });
  response.flushHeaders?.();
}

export function writeSseComment(response: Response, comment: string): void {
  if (response.writableEnded) {
    return;
  }

  response.write(`: ${comment}\n\n`);
}

export function writeSseEvent(
  response: Response,
  event: string,
  payload: unknown,
): void {
  if (response.writableEnded) {
    return;
  }

  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}
