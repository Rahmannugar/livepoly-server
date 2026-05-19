export const GAME_STATE = {
  ttlSeconds: 24 * 60 * 60,
  updateMaxAttempts: 5,
  updateRetryDelayMs: 25,
} as const;

export const GAME_BOTS = {
  actionDelayMs: {
    easy: 1400,
    normal: 1000,
    hard: 750,
  },
  cashReserve: {
    easy: 200,
    normal: 350,
    hard: 500,
  },
  auctionMaxPriceRatio: {
    easy: 0.55,
    normal: 0.75,
    hard: 0.9,
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
  realtimePublished: 'Custom/Game/Realtime/Published',
  realtimePublishFailed: 'Custom/Game/Realtime/PublishFailed',
  commandSucceeded: (command: string) =>
    `Custom/Game/Command/Succeeded/${command}`,
  commandFailed: (command: string) => `Custom/Game/Command/Failed/${command}`,
} as const;
