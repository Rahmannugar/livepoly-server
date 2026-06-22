import {
  reduceGameEngineIntent,
  type GameEngineIntent,
} from '../game-engine-intents';
import { GameEngineError } from '../game-engine.types';
import {
  createGameEnginePlayer,
  createGameEngineState,
  TEST_BOARD_TILES,
} from './game-engine.test-factory';

describe('game-engine-intents', () => {
  it('runs roll and move intent', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
    });

    const result = reduceGameEngineIntent(state, {
      type: 'roll_and_move',
      payload: {
        roomPlayerId: 'room-player-1',
        dice: [1, 2],
      },
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_property_decision',
      pendingTileKey: TEST_BOARD_TILES.cheapPropertyPair,
    });
    expect(result.events).toContainEqual({
      type: 'player_moved',
      roomPlayerId: 'room-player-1',
      fromPosition: 0,
      toPosition: 3,
      dice: [1, 2],
    });
  });

  it('runs buy property intent', () => {
    const state = createGameEngineState({
      phase: 'awaiting_property_decision',
      pendingTileKey: TEST_BOARD_TILES.cheapProperty,
    });

    const result = reduceGameEngineIntent(state, {
      type: 'buy_property',
      payload: {
        roomPlayerId: 'room-player-1',
      },
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
    });
    expect(
      result.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
      ),
    ).toMatchObject({
      ownerRoomPlayerId: 'room-player-1',
    });
  });

  it('runs building intent', () => {
    const state = createGameEngineState({
      phase: 'awaiting_turn_end',
      properties: createGameEngineState().properties.map((property) => {
        if (
          property.tileKey === TEST_BOARD_TILES.cheapProperty ||
          property.tileKey === TEST_BOARD_TILES.cheapPropertyPair
        ) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
          };
        }

        return property;
      }),
    });

    const result = reduceGameEngineIntent(state, {
      type: 'build_property',
      payload: {
        roomPlayerId: 'room-player-1',
        tileKey: TEST_BOARD_TILES.cheapProperty,
      },
    });

    expect(
      result.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
      ),
    ).toMatchObject({
      houseCount: 1,
    });
    expect(result.events).toEqual([
      {
        type: 'property_house_built',
        roomPlayerId: 'room-player-1',
        tileKey: TEST_BOARD_TILES.cheapProperty,
        houseCount: 1,
        amount: 50,
      },
    ]);
  });

  it('runs mortgage intent', () => {
    const state = createGameEngineState({
      phase: 'awaiting_turn_end',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
          };
        }

        return property;
      }),
    });

    const result = reduceGameEngineIntent(state, {
      type: 'mortgage_property',
      payload: {
        roomPlayerId: 'room-player-1',
        tileKey: TEST_BOARD_TILES.cheapProperty,
      },
    });

    expect(result.state.players[0].cash).toBe(1530);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
      ),
    ).toMatchObject({
      mortgaged: true,
    });
  });

  it('marks bot trade proposals for the current turn', () => {
    const state = createGameEngineState({
      phase: 'awaiting_turn_end',
      currentTurnRoomPlayerId: 'bot-player-1',
      players: [
        createGameEnginePlayer({
          roomPlayerId: 'bot-player-1',
          userId: null,
          username: null,
          playerType: 'bot',
          botDifficulty: 'normal',
          botName: 'Ada',
          seatNumber: 1,
        }),
        createGameEnginePlayer({
          roomPlayerId: 'room-player-2',
          userId: 'user-2',
          username: 'playertwo',
          seatNumber: 2,
        }),
      ],
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
          return {
            ...property,
            ownerRoomPlayerId: 'bot-player-1',
          };
        }

        if (property.tileKey === TEST_BOARD_TILES.cheapPropertyPair) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-2',
          };
        }

        return property;
      }),
    });

    const result = reduceGameEngineIntent(state, {
      type: 'propose_trade',
      payload: {
        roomPlayerId: 'bot-player-1',
        toRoomPlayerId: 'room-player-2',
        offeredCash: 72,
        requestedCash: 0,
        offeredPropertyKeys: [],
        requestedPropertyKeys: [TEST_BOARD_TILES.cheapPropertyPair],
      },
    });

    expect(result.state.players[0]).toMatchObject({
      lastBotTradeProposalTurnNumber: 1,
    });
    expect(result.state.tradeOffer).toMatchObject({
      fromRoomPlayerId: 'bot-player-1',
      toRoomPlayerId: 'room-player-2',
    });
  });

  it('allows active non-current players to propose trades during stable table phases', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      currentTurnRoomPlayerId: 'room-player-1',
    });

    const result = reduceGameEngineIntent(state, {
      type: 'propose_trade',
      payload: {
        roomPlayerId: 'room-player-2',
        toRoomPlayerId: 'room-player-1',
        offeredCash: 25,
        requestedCash: 1,
        offeredPropertyKeys: [],
        requestedPropertyKeys: [],
      },
    });

    expect(result.state.tradeOffer).toMatchObject({
      fromRoomPlayerId: 'room-player-2',
      toRoomPlayerId: 'room-player-1',
      offeredCash: 25,
    });
  });

  it('rejects a stale trade when property ownership changed before acceptance', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapPropertyPair) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-2',
          };
        }

        return property;
      }),
    });
    const proposed = reduceGameEngineIntent(state, {
      type: 'propose_trade',
      payload: {
        roomPlayerId: 'room-player-1',
        toRoomPlayerId: 'room-player-2',
        offeredCash: 25,
        requestedCash: 0,
        offeredPropertyKeys: [],
        requestedPropertyKeys: [TEST_BOARD_TILES.cheapPropertyPair],
      },
    });
    const changedState = {
      ...proposed.state,
      properties: proposed.state.properties.map((property) =>
        property.tileKey === TEST_BOARD_TILES.cheapPropertyPair
          ? { ...property, ownerRoomPlayerId: 'room-player-3' }
          : property,
      ),
    };

    expect(() =>
      reduceGameEngineIntent(changedState, {
        type: 'accept_trade',
        payload: {
          roomPlayerId: 'room-player-2',
          tradeId: proposed.state.tradeOffer!.id,
        },
      }),
    ).toThrow('Player does not own one of the traded properties');
  });

  it('charges the new owner when a player lands after an accepted trade', () => {
    const baseState = createGameEngineState();
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      currentTurnRoomPlayerId: 'room-player-3',
      players: baseState.players.map((player) =>
        player.roomPlayerId === 'room-player-3'
          ? { ...player, position: 39 }
          : player,
      ),
      properties: baseState.properties.map((property) =>
        property.tileKey === TEST_BOARD_TILES.cheapProperty
          ? { ...property, ownerRoomPlayerId: 'room-player-1' }
          : property,
      ),
    });
    const proposed = reduceGameEngineIntent(state, {
      type: 'propose_trade',
      payload: {
        roomPlayerId: 'room-player-1',
        toRoomPlayerId: 'room-player-2',
        offeredCash: 0,
        requestedCash: 1,
        offeredPropertyKeys: [TEST_BOARD_TILES.cheapProperty],
        requestedPropertyKeys: [],
      },
    });
    const accepted = reduceGameEngineIntent(proposed.state, {
      type: 'accept_trade',
      payload: {
        roomPlayerId: 'room-player-2',
        tradeId: proposed.state.tradeOffer!.id,
      },
    });
    const landed = reduceGameEngineIntent(accepted.state, {
      type: 'roll_and_move',
      payload: {
        roomPlayerId: 'room-player-3',
        dice: [1, 1],
      },
    });

    expect(
      accepted.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
      ),
    ).toMatchObject({ ownerRoomPlayerId: 'room-player-2' });
    expect(landed.events).toContainEqual({
      type: 'rent_paid',
      payerRoomPlayerId: 'room-player-3',
      ownerRoomPlayerId: 'room-player-2',
      tileKey: TEST_BOARD_TILES.cheapProperty,
      amount: 2,
    });
  });

  it('runs timed finish intent', () => {
    const result = reduceGameEngineIntent(
      createGameEngineState({
        phase: 'awaiting_roll',
      }),
      {
        type: 'finish_game_by_time',
        payload: {
          finishedAt: 1779150000000,
        },
      },
    );

    expect(result.state.phase).toBe('finished');
    expect(result.events[0]).toMatchObject({
      type: 'game_finished_by_time',
      finishedAt: 1779150000000,
    });
  });

  it('throws engine errors from invalid intents', () => {
    const intent: GameEngineIntent = {
      type: 'roll_and_move',
      payload: {
        roomPlayerId: 'room-player-2',
        dice: [1, 2],
      },
    };

    expect(() =>
      reduceGameEngineIntent(createGameEngineState(), intent),
    ).toThrow(GameEngineError);
  });

  it('does not mutate the original state', () => {
    const state = createGameEngineState({
      phase: 'awaiting_property_decision',
      pendingTileKey: TEST_BOARD_TILES.cheapProperty,
    });

    reduceGameEngineIntent(state, {
      type: 'buy_property',
      payload: {
        roomPlayerId: 'room-player-1',
      },
    });

    expect(state.phase).toBe('awaiting_property_decision');
    expect(state.pendingTileKey).toBe(TEST_BOARD_TILES.cheapProperty);
    expect(
      state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
      ),
    ).toMatchObject({
      ownerRoomPlayerId: null,
    });
  });
});
