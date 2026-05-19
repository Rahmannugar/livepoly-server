import type {
  DiceRoll,
  GameEngineAuction,
  GameEngineDeckState,
  GameEngineDecks,
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
    decks: cloneGameDecks(state.decks),
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

export function cloneGameDecks(decks: GameEngineDecks): GameEngineDecks {
  return {
    chance: cloneGameDeckState(decks.chance),
    worldFund: cloneGameDeckState(decks.worldFund),
  };
}

export function cloneGameDeckState(
  deck: GameEngineDeckState,
): GameEngineDeckState {
  return {
    drawPile: [...deck.drawPile],
    discardPile: [...deck.discardPile],
  };
}

export function cloneDiceRoll(dice: DiceRoll): DiceRoll {
  return [dice[0], dice[1]];
}
