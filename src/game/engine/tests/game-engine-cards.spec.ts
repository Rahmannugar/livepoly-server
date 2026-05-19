import { createInitialDeckState, drawAndApplyCard } from '../game-engine-cards';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-cards', () => {
  it('creates deterministic initial card decks', () => {
    const decks = createInitialDeckState();

    expect(decks.chance.drawPile[0]).toBe('chance_bank_dividend');
    expect(decks.worldFund.drawPile[0]).toBe('world_fund_receive_25');
    expect(decks.chance.discardPile).toEqual([]);
    expect(decks.worldFund.discardPile).toEqual([]);
  });

  it('draws and applies a collect money chance card', () => {
    const result = drawAndApplyCard(createGameEngineState(), {
      roomPlayerId: 'room-player-1',
      deckKey: 'chance',
    });

    expect(result.state.players[0].cash).toBe(1550);
    expect(result.state.decks.chance.drawPile[0]).toBe('chance_advance_to_go');
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

  it('draws and applies a pay money world fund card', () => {
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

  it('applies get out of jail free card without discarding it', () => {
    const state = createGameEngineState();

    state.decks.chance.drawPile = ['chance_get_out_of_jail_free'];

    const result = drawAndApplyCard(state, {
      roomPlayerId: 'room-player-1',
      deckKey: 'chance',
    });

    expect(result.state.players[0].getOutOfJailFreeCards).toBe(1);
    expect(result.state.decks.chance.discardPile).toEqual([]);
  });

  it('reshuffles discard pile into draw pile deterministically when draw pile is empty', () => {
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
