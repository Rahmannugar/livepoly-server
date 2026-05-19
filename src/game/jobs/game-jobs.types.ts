import type { ExecuteBotTurnJob } from '../bots/game-bot.types';
import type { ExecuteTurnTimeoutJob } from '../timers/game-turn-timer.types';

export type GameJob = ExecuteBotTurnJob | ExecuteTurnTimeoutJob;
