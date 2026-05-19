import { getGameBoard } from './game-board';
import type { TaxTile } from './game-board.types';
import { debitPlayerOrCreateDebt } from './game-engine-money';
import {
  GameEngineError,
  type GameEngineEvent,
  type GameEngineResult,
  type GameEngineState,
} from './game-engine.types';

export function payTax(
  state: GameEngineState,
  input: {
    roomPlayerId: string;
    tileKey: string;
  },
): GameEngineResult {
  const tile = getTaxTile(state, input.tileKey);
  const paymentResult = debitPlayerOrCreateDebt(state, {
    roomPlayerId: input.roomPlayerId,
    amount: tile.amount,
    reason: 'tax',
  });
  const events: GameEngineEvent[] = paymentResult.paid
    ? [
        {
          type: 'tax_paid',
          roomPlayerId: input.roomPlayerId,
          tileKey: tile.key,
          amount: tile.amount,
        },
      ]
    : paymentResult.events;

  return {
    state: paymentResult.state,
    events,
  };
}

function getTaxTile(state: GameEngineState, tileKey: string): TaxTile {
  const board = getGameBoard(state.boardKey);
  const tile = board.tiles.find((candidate) => candidate.key === tileKey);

  if (!tile || tile.kind !== 'tax') {
    throw new GameEngineError('TILE_NOT_OWNABLE', 'Tile is not tax');
  }

  return tile;
}
