import { calculateNetWorthStandings } from '../game-engine-derived-state';
import { GameEngineService } from '../game-engine.service';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-finish', () => {
  let service: GameEngineService;

  beforeEach(() => {
    service = new GameEngineService();
  });

  it('calculates net worth from cash, assets, buildings, and mortgages', () => {
    const state = createGameEngineState({
      players: createGameEngineState().players.map((player) => {
        if (player.roomPlayerId === 'room-player-1') {
          return {
            ...player,
            cash: 100,
          };
        }

        if (player.roomPlayerId === 'room-player-2') {
          return {
            ...player,
            cash: 1300,
          };
        }

        if (player.roomPlayerId === 'room-player-3') {
          return {
            ...player,
            cash: 900,
          };
        }

        return player;
      }),
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            houseCount: 2,
          };
        }

        if (property.tileKey === 'lagos_airport') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            mortgaged: true,
          };
        }

        return property;
      }),
    });

    const standings = calculateNetWorthStandings(state);

    expect(standings[0]).toMatchObject({
      roomPlayerId: 'room-player-2',
      cash: 1300,
      assetValue: 0,
      netWorth: 1300,
    });
    expect(standings[1]).toMatchObject({
      roomPlayerId: 'room-player-3',
      cash: 900,
      assetValue: 0,
      netWorth: 900,
    });
    expect(standings[2]).toMatchObject({
      roomPlayerId: 'room-player-1',
      cash: 100,
      assetValue: 210,
      netWorth: 310,
    });
  });

  it('finishes game by time and chooses highest net worth winner', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      players: createGameEngineState().players.map((player) => {
        if (player.roomPlayerId === 'room-player-1') {
          return {
            ...player,
            cash: 2000,
          };
        }

        return player;
      }),
    });

    const result = service.finishGameByTime(state, {
      finishedAt: 1779150000000,
    });

    expect(result.state).toMatchObject({
      phase: 'finished',
      auction: null,
      pendingTileKey: null,
      shouldCurrentPlayerPlayAgain: false,
      consecutiveDoublesCount: 0,
    });
    expect(result.events).toEqual([
      {
        type: 'game_finished_by_time',
        finishedAt: 1779150000000,
        winnerRoomPlayerId: 'room-player-1',
        tiedRoomPlayerIds: ['room-player-1'],
        standings: [
          {
            roomPlayerId: 'room-player-1',
            seatNumber: 1,
            cash: 2000,
            assetValue: 0,
            netWorth: 2000,
          },
          {
            roomPlayerId: 'room-player-2',
            seatNumber: 2,
            cash: 1500,
            assetValue: 0,
            netWorth: 1500,
          },
          {
            roomPlayerId: 'room-player-3',
            seatNumber: 3,
            cash: 1500,
            assetValue: 0,
            netWorth: 1500,
          },
        ],
      },
    ]);
  });

  it('returns no single winner when players tie on net worth', () => {
    const result = service.finishGameByTime(
      createGameEngineState({
        phase: 'awaiting_roll',
      }),
      {
        finishedAt: 1779150000000,
      },
    );

    expect(result.events[0]).toMatchObject({
      type: 'game_finished_by_time',
      winnerRoomPlayerId: null,
      tiedRoomPlayerIds: ['room-player-1', 'room-player-2', 'room-player-3'],
    });
  });

  it('excludes bankrupt players from timed standings', () => {
    const result = service.finishGameByTime(
      createGameEngineState({
        phase: 'awaiting_roll',
        players: createGameEngineState().players.map((player) => {
          if (player.roomPlayerId === 'room-player-2') {
            return {
              ...player,
              cash: 9999,
              bankrupt: true,
            };
          }

          return player;
        }),
      }),
      {
        finishedAt: 1779150000000,
      },
    );

    expect(result.events[0]).toMatchObject({
      type: 'game_finished_by_time',
      tiedRoomPlayerIds: ['room-player-1', 'room-player-3'],
    });
  });

  it('rejects finishing a game that is already finished', () => {
    expect(() =>
      service.finishGameByTime(
        createGameEngineState({
          phase: 'finished',
        }),
        {
          finishedAt: 1779150000000,
        },
      ),
    ).toThrow(GameEngineError);
  });

  it('rejects invalid finish timestamps', () => {
    expect(() =>
      service.finishGameByTime(createGameEngineState(), {
        finishedAt: 0,
      }),
    ).toThrow(GameEngineError);
  });

  it('rejects finishing before configured expiry time', () => {
    expect(() =>
      service.finishGameByTime(
        createGameEngineState({
          expiresAt: 1779150000000,
        }),
        {
          finishedAt: 1779149999999,
        },
      ),
    ).toThrow(GameEngineError);
  });
});
