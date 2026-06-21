import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { finalize } from 'rxjs';
import { ObservabilityService } from '../../infra/observability/observability.service';
import type { AuthenticatedGameSocket } from './game-realtime.types';

const QUIET_REALTIME_OPERATIONS = new Set(['heartbeat', 'getPresence']);

@Injectable()
export class GameRealtimeObservabilityInterceptor implements NestInterceptor {
  constructor(private readonly observabilityService: ObservabilityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const operation = context.getHandler().name;

    if (QUIET_REALTIME_OPERATIONS.has(operation)) {
      this.observabilityService.ignoreCurrentTransaction();
      return next.handle();
    }

    const startedAt = Date.now();
    const socket = context.switchToWs().getClient<AuthenticatedGameSocket>();
    const payload = context.switchToWs().getData<unknown>();

    this.observabilityService.nameCurrentTransaction(
      `Realtime/WebSocket/Game/${operation}`,
      {
        transport: 'websocket',
        operation,
        socketId: socket.id,
        userId: socket.data.user?.id,
        gameId: getGameId(payload),
      },
    );

    return next.handle().pipe(
      finalize(() => {
        this.observabilityService.recordDurationMetric(
          `Custom/Realtime/WebSocket/Game/${operation}/Duration`,
          Date.now() - startedAt,
        );
      }),
    );
  }
}

function getGameId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object' || !('gameId' in payload)) {
    return undefined;
  }

  return typeof payload.gameId === 'string' ? payload.gameId : undefined;
}
