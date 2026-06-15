import { createInitialDeckState, drawAndApplyCard } from '../game-engine-cards';
import { GameEngineError } from '../game-engine.types';
import {
  createGameEngineState,
  TEST_BOARD_TILES,
} from './game-engine.test-factory';

describe('game-engine-cards', () => {
  it('creates deterministic initial card decks', () => {
    const decks = createInitialDeckState();

    expect(decks.chance.drawPile[0]).toBe('chance_bank_dividend');
    expect(decks.worldFund.drawPile[0]).toBe('world_fund_receive_25');
    expect(decks.chance.drawPile).toHaveLength(16);
    expect(decks.worldFund.drawPile).toHaveLength(16);
    expect(decks.chance.discardPile).toEqual([]);
    expect(decks.worldFund.discardPile).toEqual([]);
  });

  it('applies a collect money card', () => {
    const result = drawAndApplyCard(createGameEngineState(), {
      roomPlayerId: 'room-player-1',
      deckKey: 'chance',
    });

    expect(result.state.players[0].cash).toBe(1550);
    expect(result.state.decks.chance.drawPile[0]).toBe(
      'chance_chairman_bonus',
    );
    expect(result.state.decks.chance.discardPile).toEqual([
      'chance_bank_dividend',
    ]);
    expect(result.events).toEqual([
      {
        type: 'card_drawn',
        roomPlayerId: 'room-player-1',
        deckKey: 'chance',
        cardKey: 'chance_bank_dividend',
      },
      {
        type: 'card_applied',
        roomPlayerId: 'room-player-1',
        deckKey: 'chance',
        cardKey: 'chance_bank_dividend',
        effectType: 'collect_money',
      },
    ]);
  });

  it('applies a pay money card', () => {
    const state = createGameEngineState();

    state.decks.worldFund.drawPile = ['world_fund_pay_hospital'];

    const result = drawAndApplyCard(state, {
      roomPlayerId: 'room-player-1',
      deckKey: 'world_fund',
    });

    expect(result.state.players[0].cash).toBe(1400);
    expect(result.events).toEqual([
      {
        type: 'card_drawn',
        roomPlayerId: 'room-player-1',
        deckKey: 'world_fund',
        cardKey: 'world_fund_pay_hospital',
      },
      {
        type: 'card_applied',
        roomPlayerId: 'room-player-1',
        deckKey: 'world_fund',
        cardKey: 'world_fund_pay_hospital',
        effectType: 'pay_money',
      },
    ]);
  });

  it('creates debt for unaffordable money card', () => {
    const state = createGameEngineState({
      players: createGameEngineState().players.map((player) => {
        if (player.roomPlayerId === 'room-player-1') {
          return {
            ...player,
            cash: 25,
          };
        }

        return player;
      }),
    });

    state.decks.worldFund.drawPile = ['world_fund_pay_hospital'];

    const result = drawAndApplyCard(state, {
      roomPlayerId: 'room-player-1',
      deckKey: 'world_fund',
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_debt_resolution',
      debt: {
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: null,
        amount: 100,
        reason: 'card',
      },
    });
    expect(result.events).toContainEqual({
      type: 'payment_required',
      roomPlayerId: 'room-player-1',
      creditorRoomPlayerId: null,
      amount: 100,
      reason: 'card',
    });
  });

  it('applies go to jail card', () => {
    const state = createGameEngineState();

    state.decks.chance.drawPile = ['chance_go_to_jail'];

    const result = drawAndApplyCard(state, {
      roomPlayerId: 'room-player-1',
      deckKey: 'chance',
    });

    expect(result.state.players[0]).toMatchObject({
      position: 10,
      inJail: true,
    });
    expect(result.events).toContainEqual({
      type: 'player_sent_to_jail',
      roomPlayerId: 'room-player-1',
      jailPosition: 10,
    });
  });

  it('moves a player back three spaces', () => {
    const state = createGameEngineState({
      players: createGameEngineState().players.map((player) =>
        player.roomPlayerId === 'room-player-1'
          ? { ...player, position: 7 }
          : player,
      ),
    });

    state.decks.chance.drawPile = ['chance_go_back_three'];

    const result = drawAndApplyCard(state, {
      roomPlayerId: 'room-player-1',
      deckKey: 'chance',
    });

    expect(result.state.players[0].position).toBe(4);
    expect(result.state.players[0].cash).toBe(1300);
    expect(result.events).toContainEqual({
      type: 'player_landed_on_tile',
      roomPlayerId: 'room-player-1',
      tileKey: 'income_tax',
      tileKind: 'tax',
    });
    expect(result.events).toContainEqual({
      type: 'tax_paid',
      roomPlayerId: 'room-player-1',
      tileKey: 'income_tax',
      amount: 200,
    });
  });

  it('moves a player to the nearest airport', () => {
    const state = createGameEngineState({
      players: createGameEngineState().players.map((player) =>
        player.roomPlayerId === 'room-player-1'
          ? { ...player, position: 22 }
          : player,
      ),
    });

    state.decks.chance.drawPile = ['chance_nearest_airport'];

    const result = drawAndApplyCard(state, {
      roomPlayerId: 'room-player-1',
      deckKey: 'chance',
    });

    expect(result.state.players[0].position).toBe(25);
    expect(result.events).toContainEqual({
      type: 'player_landed_on_tile',
      roomPlayerId: 'room-player-1',
      tileKey: 'london_airport',
      tileKind: 'airport',
    });
  });

  it('charges repairs from owned buildings', () => {
    const state = createGameEngineState({
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            houseCount: 2,
          };
        }

        if (property.tileKey === TEST_BOARD_TILES.highValueProperty) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            hasHotel: true,
          };
        }

        return property;
      }),
    });

    state.decks.chance.drawPile = ['chance_building_repairs'];

    const result = drawAndApplyCard(state, {
      roomPlayerId: 'room-player-1',
      deckKey: 'chance',
    });

    expect(result.state.players[0].cash).toBe(1350);
  });

  it('collects from every other player', () => {
    const state = createGameEngineState();

    state.decks.worldFund.drawPile = ['world_fund_birthday'];

    const result = drawAndApplyCard(state, {
      roomPlayerId: 'room-player-1',
      deckKey: 'world_fund',
    });

    expect(result.state.players[0].cash).toBe(1520);
    expect(result.state.players[1].cash).toBe(1490);
    expect(result.state.players[2].cash).toBe(1490);
  });

  it('pays every other player', () => {
    const state = createGameEngineState();

    state.decks.chance.drawPile = ['chance_pay_each_player'];

    const result = drawAndApplyCard(state, {
      roomPlayerId: 'room-player-1',
      deckKey: 'chance',
    });

    expect(result.state.players[0].cash).toBe(1400);
    expect(result.state.players[1].cash).toBe(1550);
    expect(result.state.players[2].cash).toBe(1550);
  });

  it('keeps get out of jail card with player', () => {
    const state = createGameEngineState();

    state.decks.chance.drawPile = ['chance_get_out_of_jail_free'];

    const result = drawAndApplyCard(state, {
      roomPlayerId: 'room-player-1',
      deckKey: 'chance',
    });

    expect(result.state.players[0].getOutOfJailFreeCards).toBe(1);
    expect(result.state.players[0].getOutOfJailFreeCardKeys).toEqual([
      'chance_get_out_of_jail_free',
    ]);
    expect(result.state.decks.chance.discardPile).toEqual([]);
  });

  it('draws from returned bottom cards when draw pile is empty', () => {
    const state = createGameEngineState();

    state.decks.chance.drawPile = [];
    state.decks.chance.discardPile = ['chance_bank_dividend'];

    const result = drawAndApplyCard(state, {
      roomPlayerId: 'room-player-1',
      deckKey: 'chance',
    });

    expect(result.state.players[0].cash).toBe(1550);
    expect(result.state.decks.chance.drawPile).toEqual([]);
    expect(result.state.decks.chance.discardPile).toEqual([
      'chance_bank_dividend',
    ]);
  });

  it('throws when a deck is empty', () => {
    const state = createGameEngineState();

    state.decks.chance.drawPile = [];
    state.decks.chance.discardPile = [];

    expect(() =>
      drawAndApplyCard(state, {
        roomPlayerId: 'room-player-1',
        deckKey: 'chance',
      }),
    ).toThrow(new GameEngineError('CARD_DECK_EMPTY', 'Card deck is empty'));
  });
});
