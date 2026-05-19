import { getGameBoard, getTile } from './game-board';
import { cloneDiceRoll } from './game-engine-cloner';
import { sendPlayerToJail } from './game-engine-jail';
import {
  creditPlayer,
  debitPlayerOrCreateDebt,
  findPlayer,
} from './game-engine-money';
import { isOwnableTile } from './game-engine-properties';
import { payRent } from './game-engine-rent';
import {
  GameEngineError,
  type DrawCardInput,
  type GameCardDeckKey,
  type GameEngineCard,
  type GameEngineDeckState,
  type GameEngineEvent,
  type GameEngineResult,
  type GameEngineState,
} from './game-engine.types';

export const CHANCE_CARDS = [
  {
    key: 'chance_bank_dividend',
    title: 'Bank dividend',
    effect: {
      type: 'collect_money',
      amount: 50,
    },
  },
  {
    key: 'chance_advance_to_go',
    title: 'Advance to Go',
    effect: {
      type: 'move_to_tile',
      tileKey: 'go',
      collectPassGo: true,
    },
  },
  {
    key: 'chance_go_to_jail',
    title: 'Go to Jail',
    effect: {
      type: 'go_to_jail',
    },
  },
  {
    key: 'chance_pay_school_fees',
    title: 'Pay school fees',
    effect: {
      type: 'pay_money',
      amount: 50,
    },
  },
  {
    key: 'chance_get_out_of_jail_free',
    title: 'Get Out of Jail Free',
    effect: {
      type: 'get_out_of_jail_free',
    },
  },
] as const satisfies readonly GameEngineCard[];

export const WORLD_FUND_CARDS = [
  {
    key: 'world_fund_receive_25',
    title: 'Receive world fund support',
    effect: {
      type: 'collect_money',
      amount: 25,
    },
  },
  {
    key: 'world_fund_pay_hospital',
    title: 'Pay hospital fees',
    effect: {
      type: 'pay_money',
      amount: 100,
    },
  },
  {
    key: 'world_fund_advance_to_go',
    title: 'Advance to Go',
    effect: {
      type: 'move_to_tile',
      tileKey: 'go',
      collectPassGo: true,
    },
  },
  {
    key: 'world_fund_go_to_jail',
    title: 'Go to Jail',
    effect: {
      type: 'go_to_jail',
    },
  },
  {
    key: 'world_fund_get_out_of_jail_free',
    title: 'Get Out of Jail Free',
    effect: {
      type: 'get_out_of_jail_free',
    },
  },
] as const satisfies readonly GameEngineCard[];

const CARDS_BY_KEY = new Map<string, GameEngineCard>(
  [...CHANCE_CARDS, ...WORLD_FUND_CARDS].map((card) => [card.key, card]),
);

export function createInitialDeckState(
  options: {
    seed?: string | null;
  } = {},
): GameEngineState['decks'] {
  const chanceCards = CHANCE_CARDS.map((card) => card.key);
  const worldFundCards = WORLD_FUND_CARDS.map((card) => card.key);

  return {
    chance: {
      drawPile: options.seed
        ? shuffleDeterministically(chanceCards, `${options.seed}:chance`)
        : chanceCards,
      discardPile: [],
    },
    worldFund: {
      drawPile: options.seed
        ? shuffleDeterministically(worldFundCards, `${options.seed}:world_fund`)
        : worldFundCards,
      discardPile: [],
    },
  };
}

export function drawAndApplyCard(
  state: GameEngineState,
  input: DrawCardInput,
): GameEngineResult {
  const drawResult = drawCard(state, input.deckKey);
  const card = CARDS_BY_KEY.get(drawResult.cardKey);

  if (!card) {
    throw new GameEngineError('CARD_NOT_FOUND', 'Card was not found');
  }

  const drawEvent: GameEngineEvent = {
    type: 'card_drawn',
    roomPlayerId: input.roomPlayerId,
    deckKey: input.deckKey,
    cardKey: card.key,
  };

  const appliedEvent: GameEngineEvent = {
    type: 'card_applied',
    roomPlayerId: input.roomPlayerId,
    deckKey: input.deckKey,
    cardKey: card.key,
    effectType: card.effect.type,
  };

  const appliedResult = applyCardEffect(drawResult.state, input, card);

  return {
    state: appliedResult.state,
    events: [drawEvent, appliedEvent, ...appliedResult.events],
  };
}

function drawCard(
  state: GameEngineState,
  deckKey: GameCardDeckKey,
): {
  state: GameEngineState;
  cardKey: string;
} {
  const deck = getDeck(state, deckKey);
  const drawPile = deck.drawPile.length > 0 ? deck.drawPile : deck.discardPile;
  const discardPile = deck.drawPile.length > 0 ? deck.discardPile : [];

  const [cardKey, ...remainingDrawPile] = drawPile;

  if (!cardKey) {
    throw new GameEngineError('CARD_DECK_EMPTY', 'Card deck is empty');
  }

  const card = CARDS_BY_KEY.get(cardKey);

  if (!card) {
    throw new GameEngineError('CARD_NOT_FOUND', 'Card was not found');
  }

  const nextDeck: GameEngineDeckState = {
    drawPile: remainingDrawPile,
    discardPile:
      card.effect.type === 'get_out_of_jail_free'
        ? discardPile
        : [...discardPile, cardKey],
  };

  return {
    state: setDeck(state, deckKey, nextDeck),
    cardKey,
  };
}

function applyCardEffect(
  state: GameEngineState,
  input: DrawCardInput,
  card: GameEngineCard,
): GameEngineResult {
  if (card.effect.type === 'collect_money') {
    return {
      state: creditPlayer(state, input.roomPlayerId, card.effect.amount),
      events: [],
    };
  }

  if (card.effect.type === 'pay_money') {
    const paymentResult = debitPlayerOrCreateDebt(state, {
      roomPlayerId: input.roomPlayerId,
      amount: card.effect.amount,
      reason: 'card',
    });

    return {
      state: paymentResult.state,
      events: paymentResult.events,
    };
  }

  if (card.effect.type === 'go_to_jail') {
    return sendPlayerToJail(state, input.roomPlayerId);
  }

  if (card.effect.type === 'get_out_of_jail_free') {
    return {
      state: {
        ...state,
        players: state.players.map((player) => {
          if (player.roomPlayerId !== input.roomPlayerId) {
            return player;
          }

          return {
            ...player,
            getOutOfJailFreeCards: player.getOutOfJailFreeCards + 1,
          };
        }),
      },
      events: [],
    };
  }

  return movePlayerToCardTile(state, input, card.effect);
}

function movePlayerToCardTile(
  state: GameEngineState,
  input: DrawCardInput,
  effect: {
    type: 'move_to_tile';
    tileKey: string;
    collectPassGo: boolean;
  },
): GameEngineResult {
  const board = getGameBoard(state.boardKey);
  const player = findPlayer(state, input.roomPlayerId);
  const targetTile = board.tiles.find((tile) => tile.key === effect.tileKey);

  if (!targetTile) {
    throw new GameEngineError(
      'CARD_NOT_FOUND',
      'Card target tile was not found',
    );
  }

  const passedGo =
    effect.collectPassGo &&
    targetTile.index <= player.position &&
    targetTile.index !== player.position;

  const movedEvents: GameEngineEvent[] = [
    {
      type: 'player_moved',
      roomPlayerId: input.roomPlayerId,
      fromPosition: player.position,
      toPosition: targetTile.index,
      dice: cloneDiceRoll(state.lastDiceRoll ?? [0, 0]),
    },
  ];

  let nextState = passedGo
    ? creditPlayer(state, input.roomPlayerId, board.passGoCash)
    : state;

  if (passedGo) {
    movedEvents.push({
      type: 'player_passed_go',
      roomPlayerId: input.roomPlayerId,
      amount: board.passGoCash,
    });
  }

  nextState = {
    ...nextState,
    phase: 'awaiting_turn_end',
    pendingTileKey: null,
    players: nextState.players.map((candidate) => {
      if (candidate.roomPlayerId !== input.roomPlayerId) {
        return candidate;
      }

      return {
        ...candidate,
        position: targetTile.index,
      };
    }),
  };

  movedEvents.push({
    type: 'player_landed_on_tile',
    roomPlayerId: input.roomPlayerId,
    tileKey: targetTile.key,
    tileKind: targetTile.kind,
  });

  if (targetTile.kind === 'go_to_jail') {
    const jailResult = sendPlayerToJail(nextState, input.roomPlayerId);

    return {
      state: jailResult.state,
      events: [...movedEvents, ...jailResult.events],
    };
  }

  const property = nextState.properties.find(
    (candidate) => candidate.tileKey === targetTile.key,
  );

  if (isOwnableTile(targetTile) && property && !property.ownerRoomPlayerId) {
    return {
      state: {
        ...nextState,
        phase: 'awaiting_property_decision',
        pendingTileKey: targetTile.key,
      },
      events: movedEvents,
    };
  }

  const rentResult = payRent(nextState, {
    payerRoomPlayerId: input.roomPlayerId,
    tileKey: targetTile.key,
    dice: state.lastDiceRoll ?? [0, 0],
  });

  return {
    state: rentResult.state,
    events: [...movedEvents, ...rentResult.events],
  };
}

function getDeck(
  state: GameEngineState,
  deckKey: GameCardDeckKey,
): GameEngineDeckState {
  return deckKey === 'chance' ? state.decks.chance : state.decks.worldFund;
}

function setDeck(
  state: GameEngineState,
  deckKey: GameCardDeckKey,
  deck: GameEngineDeckState,
): GameEngineState {
  return {
    ...state,
    decks:
      deckKey === 'chance'
        ? {
            ...state.decks,
            chance: deck,
          }
        : {
            ...state.decks,
            worldFund: deck,
          },
  };
}

function shuffleDeterministically(values: string[], seed: string): string[] {
  const shuffled = [...values];
  let random = createSeededRandom(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    random = nextRandom(random);

    const swapIndex = random.value % (index + 1);
    const current = shuffled[index];

    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

function createSeededRandom(seed: string): { value: number } {
  let value = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }

  return { value: value >>> 0 };
}

function nextRandom(random: { value: number }): { value: number } {
  let value = random.value;

  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;

  return { value: value >>> 0 };
}
