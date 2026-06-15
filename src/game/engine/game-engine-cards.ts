import { getGameBoard, getTile } from './game-board';
import { cloneDiceRoll } from './game-engine-cloner';
import { sendPlayerToJail } from './game-engine-jail';
import {
  creditPlayer,
  debitPlayerOrCreateDebt,
  findPlayer,
  transferPlayerCash,
} from './game-engine-money';
import { isOwnableTile } from './game-engine-properties';
import { payRent } from './game-engine-rent';
import { payTax } from './game-engine-tax';
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
    key: 'chance_chairman_bonus',
    title: 'Chairman bonus',
    effect: {
      type: 'collect_money',
      amount: 150,
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
    key: 'chance_advance_to_spain',
    title: 'Advance to Spain',
    effect: {
      type: 'move_to_tile',
      tileKey: 'spain',
      collectPassGo: true,
    },
  },
  {
    key: 'chance_advance_to_uk',
    title: 'Advance to United Kingdom',
    effect: {
      type: 'move_to_tile',
      tileKey: 'uk',
      collectPassGo: true,
    },
  },
  {
    key: 'chance_advance_to_lagos_airport',
    title: 'Advance to Lagos Airport',
    effect: {
      type: 'move_to_tile',
      tileKey: 'lagos_airport',
      collectPassGo: true,
    },
  },
  {
    key: 'chance_nearest_airport',
    title: 'Advance to the nearest Airport',
    effect: {
      type: 'move_to_nearest',
      tileKind: 'airport',
      collectPassGo: true,
    },
  },
  {
    key: 'chance_nearest_utility',
    title: 'Advance to the nearest Utility',
    effect: {
      type: 'move_to_nearest',
      tileKind: 'utility',
      collectPassGo: true,
    },
  },
  {
    key: 'chance_go_back_three',
    title: 'Go back three spaces',
    effect: {
      type: 'move_relative',
      spaces: -3,
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
    key: 'chance_building_repairs',
    title: 'Make general repairs',
    effect: {
      type: 'property_repairs',
      houseAmount: 25,
      hotelAmount: 100,
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
    key: 'chance_speeding_fine',
    title: 'Speeding fine',
    effect: {
      type: 'pay_money',
      amount: 15,
    },
  },
  {
    key: 'chance_loan_matures',
    title: 'Loan matures',
    effect: {
      type: 'collect_money',
      amount: 150,
    },
  },
  {
    key: 'chance_pay_each_player',
    title: 'Pay every player',
    effect: {
      type: 'pay_each_player',
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
    key: 'world_fund_bank_error',
    title: 'Bank error in your favor',
    effect: {
      type: 'collect_money',
      amount: 200,
    },
  },
  {
    key: 'world_fund_doctor_fee',
    title: 'Doctor fee',
    effect: {
      type: 'pay_money',
      amount: 50,
    },
  },
  {
    key: 'world_fund_sale_of_stock',
    title: 'Sale of stock',
    effect: {
      type: 'collect_money',
      amount: 50,
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
    key: 'world_fund_life_insurance',
    title: 'Life insurance matures',
    effect: {
      type: 'collect_money',
      amount: 100,
    },
  },
  {
    key: 'world_fund_income_tax_refund',
    title: 'Income tax refund',
    effect: {
      type: 'collect_money',
      amount: 20,
    },
  },
  {
    key: 'world_fund_birthday',
    title: 'Birthday gift',
    effect: {
      type: 'collect_from_each_player',
      amount: 10,
    },
  },
  {
    key: 'world_fund_holiday_fund',
    title: 'Holiday fund matures',
    effect: {
      type: 'collect_money',
      amount: 100,
    },
  },
  {
    key: 'world_fund_consultancy_fee',
    title: 'Consultancy fee',
    effect: {
      type: 'collect_money',
      amount: 25,
    },
  },
  {
    key: 'world_fund_street_repairs',
    title: 'Street repairs',
    effect: {
      type: 'property_repairs',
      houseAmount: 40,
      hotelAmount: 115,
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
    key: 'world_fund_beauty_contest',
    title: 'Beauty contest prize',
    effect: {
      type: 'collect_money',
      amount: 10,
    },
  },
  {
    key: 'world_fund_inherit',
    title: 'Inheritance',
    effect: {
      type: 'collect_money',
      amount: 100,
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

export function returnGetOutOfJailCardToDeck(
  state: GameEngineState,
  cardKey: string | null,
): GameEngineState {
  const resolvedCardKey = cardKey ?? 'chance_get_out_of_jail_free';
  const deckKey = getDeckKeyForCard(resolvedCardKey);

  if (!deckKey) {
    throw new GameEngineError('CARD_NOT_FOUND', 'Card was not found');
  }

  const deck = getDeck(state, deckKey);

  return setDeck(state, deckKey, {
    ...deck,
    discardPile: [...deck.discardPile, resolvedCardKey],
  });
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

  if (card.effect.type === 'collect_from_each_player') {
    return collectFromEachPlayer(state, input, card.effect.amount);
  }

  if (card.effect.type === 'pay_each_player') {
    return payEachPlayer(state, input, card.effect.amount);
  }

  if (card.effect.type === 'property_repairs') {
    return payPropertyRepairs(state, input, card.effect);
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
            getOutOfJailFreeCardKeys: [
              ...(player.getOutOfJailFreeCardKeys ?? []),
              card.key,
            ],
          };
        }),
      },
      events: [],
    };
  }

  return movePlayerToCardTile(state, input, card.effect);
}

function collectFromEachPlayer(
  state: GameEngineState,
  input: DrawCardInput,
  amount: number,
): GameEngineResult {
  findPlayer(state, input.roomPlayerId);

  const otherPlayers = state.players.filter(
    (player) => player.roomPlayerId !== input.roomPlayerId && !player.bankrupt,
  );

  const nextState = otherPlayers.reduce(
    (currentState, player) =>
      transferPlayerCash(
        currentState,
        player.roomPlayerId,
        input.roomPlayerId,
        Math.min(player.cash, amount),
      ),
    state,
  );

  return {
    state: nextState,
    events: [],
  };
}

function payEachPlayer(
  state: GameEngineState,
  input: DrawCardInput,
  amount: number,
): GameEngineResult {
  const payingPlayer = findPlayer(state, input.roomPlayerId);
  const otherPlayers = state.players.filter(
    (player) => player.roomPlayerId !== input.roomPlayerId && !player.bankrupt,
  );
  const totalAmount = otherPlayers.length * amount;

  if (payingPlayer.cash < totalAmount) {
    const paymentResult = debitPlayerOrCreateDebt(state, {
      roomPlayerId: input.roomPlayerId,
      amount: totalAmount,
      reason: 'card',
    });

    return {
      state: paymentResult.state,
      events: paymentResult.events,
    };
  }

  const nextState = otherPlayers.reduce(
    (currentState, player) =>
      transferPlayerCash(
        currentState,
        input.roomPlayerId,
        player.roomPlayerId,
        amount,
      ),
    state,
  );

  return {
    state: nextState,
    events: [],
  };
}

function payPropertyRepairs(
  state: GameEngineState,
  input: DrawCardInput,
  effect: {
    type: 'property_repairs';
    houseAmount: number;
    hotelAmount: number;
  },
): GameEngineResult {
  const amount = state.properties
    .filter((property) => property.ownerRoomPlayerId === input.roomPlayerId)
    .reduce((total, property) => {
      if (property.hasHotel) {
        return total + effect.hotelAmount;
      }

      return total + property.houseCount * effect.houseAmount;
    }, 0);

  if (amount === 0) {
    return {
      state,
      events: [],
    };
  }

  const paymentResult = debitPlayerOrCreateDebt(state, {
    roomPlayerId: input.roomPlayerId,
    amount,
    reason: 'card',
  });

  return {
    state: paymentResult.state,
    events: paymentResult.events,
  };
}

function movePlayerToCardTile(
  state: GameEngineState,
  input: DrawCardInput,
  effect: {
    type: 'move_to_tile' | 'move_relative' | 'move_to_nearest';
    tileKey?: string;
    spaces?: number;
    tileKind?: string;
    collectPassGo?: boolean;
  },
): GameEngineResult {
  const board = getGameBoard(state.boardKey);
  const player = findPlayer(state, input.roomPlayerId);
  const targetTile = getCardMoveTargetTile(state, input, effect);

  if (!targetTile) {
    throw new GameEngineError(
      'CARD_NOT_FOUND',
      'Card target tile was not found',
    );
  }

  const passedGo =
    Boolean(effect.collectPassGo) &&
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

  if (targetTile.kind === 'tax') {
    const taxResult = payTax(nextState, {
      roomPlayerId: input.roomPlayerId,
      tileKey: targetTile.key,
    });

    return {
      state: taxResult.state,
      events: [...movedEvents, ...taxResult.events],
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

function getCardMoveTargetTile(
  state: GameEngineState,
  input: DrawCardInput,
  effect: {
    type: 'move_to_tile' | 'move_relative' | 'move_to_nearest';
    tileKey?: string;
    spaces?: number;
    tileKind?: string;
  },
) {
  const board = getGameBoard(state.boardKey);
  const player = findPlayer(state, input.roomPlayerId);

  if (effect.type === 'move_to_tile') {
    return board.tiles.find((tile) => tile.key === effect.tileKey);
  }

  if (effect.type === 'move_relative') {
    const targetIndex =
      (player.position + (effect.spaces ?? 0) + board.tiles.length) %
      board.tiles.length;

    return getTile(board, targetIndex);
  }

  return (
    board.tiles
      .filter((tile) => tile.kind === effect.tileKind)
      .sort((left, right) => {
        const leftDistance =
          (left.index - player.position + board.tiles.length) %
          board.tiles.length;
        const rightDistance =
          (right.index - player.position + board.tiles.length) %
          board.tiles.length;

        return leftDistance - rightDistance;
      })[0] ?? null
  );
}

function getDeckKeyForCard(cardKey: string): GameCardDeckKey | null {
  if (CHANCE_CARDS.some((card) => card.key === cardKey)) {
    return 'chance';
  }

  if (WORLD_FUND_CARDS.some((card) => card.key === cardKey)) {
    return 'worldFund';
  }

  return null;
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
