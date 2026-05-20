export const GAME_STATE = {
  ttlSeconds: 24 * 60 * 60,
  updateMaxAttempts: 5,
  updateRetryDelayMs: 25,
} as const;

export const GAME_SNAPSHOTS = {
  everyNTurns: 1,
} as const;

export const GAME_TURN_TIMER = {
  timeoutMs: 45_000,
} as const;

export const GAME_BOTS = {
  actionDelayMs: {
    min: 900,
    max: 1800,
  },
  cashReserve: {
    easy: 200,
    normal: 350,
    hard: 500,
  },
  buyScoreThreshold: {
    easy: 65,
    normal: 35,
    hard: 35,
  },
  auctionMaxPriceRatio: {
    easy: 0.55,
    normal: 0.75,
    hard: 0.9,
  },
  setCompletionBonus: {
    easy: 10,
    normal: 70,
    hard: 100,
  },
  opponentBlockBonus: {
    easy: 0,
    normal: 30,
    hard: 80,
  },
  rentPotentialWeight: {
    easy: 0.2,
    normal: 0.6,
    hard: 1,
  },
  cheapPropertyBias: {
    easy: 70,
    normal: 35,
    hard: 0,
  },
} as const;

export const GAME_COMMANDS = {
  rollAndMove: 'roll_and_move',
  buyProperty: 'buy_property',
  declinePropertyPurchase: 'decline_property_purchase',
  placeAuctionBid: 'place_auction_bid',
  passAuctionBid: 'pass_auction_bid',
  buildProperty: 'build_property',
  sellBuilding: 'sell_building',
  mortgageProperty: 'mortgage_property',
  unmortgageProperty: 'unmortgage_property',
  declareBankruptcy: 'declare_bankruptcy',
  payDebt: 'pay_debt',
  payJailFine: 'pay_jail_fine',
  endTurn: 'end_turn',
  finishGameByTime: 'finish_game_by_time',
} as const;

export const GAME_SOCKET_EVENTS = {
  join: 'game:join',
  joined: 'game:joined',
  rollAndMove: 'game:roll-and-move',
  endTurn: 'game:end-turn',
  state: 'game:state',
  events: 'game:events',
  commandRejected: 'game:command-rejected',
  error: 'game:error',
} as const;

export const GAME_REALTIME = {
  channel: 'game:realtime',
} as const;

export const GAME_EVENTS = {
  stateMissing: 'GameStateMissing',
  stateSaved: 'GameStateSaved',
  stateUpdated: 'GameStateUpdated',
  stateDeleted: 'GameStateDeleted',
  stateCorrupted: 'GameStateCorrupted',
  stateCasRetry: 'GameStateCasRetry',
  stateCasConflict: 'GameStateCasConflict',
  commandSucceeded: 'GameCommandSucceeded',
  commandFailed: 'GameCommandFailed',
  botTurnQueued: 'GameBotTurnQueued',
  botTurnSkipped: 'GameBotTurnSkipped',
  botTurnExecuted: 'GameBotTurnExecuted',
  botTurnFailed: 'GameBotTurnFailed',
  turnTimerQueued: 'GameTurnTimerQueued',
  turnTimerSkipped: 'GameTurnTimerSkipped',
  turnTimerExecuted: 'GameTurnTimerExecuted',
  turnTimerFailed: 'GameTurnTimerFailed',
  realtimePublished: 'GameRealtimePublished',
  realtimePublishFailed: 'GameRealtimePublishFailed',
  socketConnected: 'GameSocketConnected',
  socketDisconnected: 'GameSocketDisconnected',
  socketJoined: 'GameSocketJoined',
  socketAccessDenied: 'GameSocketAccessDenied',
} as const;

export const GAME_METRICS = {
  stateMissing: 'Custom/Game/State/Missing',
  stateSaved: 'Custom/Game/State/Saved',
  stateUpdated: 'Custom/Game/State/Updated',
  stateDeleted: 'Custom/Game/State/Deleted',
  stateCorrupted: 'Custom/Game/State/Corrupted',
  stateCasRetry: 'Custom/Game/State/CAS/Retry',
  stateCasConflict: 'Custom/Game/State/CAS/Conflict',
  botTurnQueued: 'Custom/Game/Bot/Queued',
  botTurnExecuted: 'Custom/Game/Bot/Executed',
  botTurnFailed: 'Custom/Game/Bot/Failed',
  turnTimerQueued: 'Custom/Game/TurnTimer/Queued',
  turnTimerExecuted: 'Custom/Game/TurnTimer/Executed',
  turnTimerFailed: 'Custom/Game/TurnTimer/Failed',
  realtimePublished: 'Custom/Game/Realtime/Published',
  realtimePublishFailed: 'Custom/Game/Realtime/PublishFailed',
  commandSucceeded: (command: string) =>
    `Custom/Game/Command/Succeeded/${command}`,
  commandFailed: (command: string) => `Custom/Game/Command/Failed/${command}`,
} as const;
