import type {
  DiceRoll,
  GameEngineAuction,
  GameEnginePlayer,
  GameEngineProperty,
  GameEngineState,
} from './game-engine.types';

export function cloneGameState(state: GameEngineState): GameEngineState {
  return {
    ...state,
    lastDiceRoll: state.lastDiceRoll ? cloneDiceRoll(state.lastDiceRoll) : null,
    pendingTileKey: state.pendingTileKey ?? null,
    auction: state.auction ? cloneGameAuction(state.auction) : null,
    players: state.players.map((player) => cloneGamePlayer(player)),
    properties: state.properties.map((property) => cloneGameProperty(property)),
  };
}

export function cloneGamePlayer(player: GameEnginePlayer): GameEnginePlayer {
  return {
    ...player,
  };
}

export function cloneGameProperty(
  property: GameEngineProperty,
): GameEngineProperty {
  return {
    ...property,
  };
}

export function cloneGameAuction(
  auction: GameEngineAuction,
): GameEngineAuction {
  return {
    ...auction,
    activeRoomPlayerIds: [...auction.activeRoomPlayerIds],
    passedRoomPlayerIds: [...auction.passedRoomPlayerIds],
  };
}

export function cloneDiceRoll(dice: DiceRoll): DiceRoll {
  return [dice[0], dice[1]];
}
