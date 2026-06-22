export const DEFAULT_K_FACTOR = 32;
export const MIN_RATING = 300;
export const DEFAULT_RATING = 500;

export const DEFAULT_STARTING_CASH = 1500;

export const GAME_STATE = {
  ttlSeconds: 24 * 60 * 60,
  updateMaxAttempts: 5,
  updateRetryDelayMs: 25,
} as const;

export const GAME_SNAPSHOTS = {
  everyNTurns: 1,
} as const;

export const GAME_TURN_TIMER = {
  timeoutMs: 90_000,
  auctionBidTimeoutMs: 25_000,
  maxConsecutiveMissedTurns: 3,
} as const;

export const GAME_TIMER_WATCHDOG = {
  intervalMs: 10_000,
  batchSize: 100,
  deadlineGraceMs: 2_000,
} as const;

export const GAME_BOTS = {
  actionDelayMs: {
    min: 900,
    max: 1800,
  },
  cashReserve: {
    easy: 200,
    normal: 350,
    hard: 300,
  },
  buyScoreThreshold: {
    easy: 65,
    normal: 35,
    hard: 35,
  },
  auctionMaxPriceRatio: {
    easy: 0.55,
    normal: 0.85,
    hard: 1.05,
  },
  auctionBidStepRatio: {
    easy: 0.03,
    normal: 0.08,
    hard: 0.14,
  },
  auctionSetCompletionPremium: {
    easy: 0,
    normal: 0.35,
    hard: 0.8,
  },
  auctionBlockPremium: {
    easy: 0,
    normal: 0.15,
    hard: 0.45,
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
  maxDevelopmentLevel: {
    easy: 1,
    normal: 3,
    hard: 5,
  },
  tradeOfferPriceRatio: {
    easy: 1.3,
    normal: 1.2,
    hard: 1.15,
  },
  tradeAcceptanceMargin: {
    easy: 0.95,
    normal: 1.1,
    hard: 1.3,
  },
  tradeSetCompletionWeight: {
    easy: 0,
    normal: 0.75,
    hard: 1.75,
  },
} as const;

export const GAME_PRESENCE = {
  ttlSeconds: 75,
  heartbeatIntervalSeconds: 25,
} as const;

export const GAME_WS_RECONNECT_GUARD = {
  connection: {
    limit: 120,
    windowSeconds: 60,
    burstLimit: 30,
  },
  join: {
    limit: 60,
    windowSeconds: 60,
    burstLimit: 20,
  },
  eventRecovery: {
    limit: 60,
    windowSeconds: 60,
    burstLimit: 15,
  },
  heartbeat: {
    limit: 180,
    windowSeconds: 60,
    burstLimit: 40,
  },
  presence: {
    limit: 120,
    windowSeconds: 60,
    burstLimit: 30,
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
  proposeTrade: 'propose_trade',
  acceptTrade: 'accept_trade',
  rejectTrade: 'reject_trade',
  cancelTrade: 'cancel_trade',
  declareBankruptcy: 'declare_bankruptcy',
  payDebt: 'pay_debt',
  payJailFine: 'pay_jail_fine',
  useGetOutOfJailCard: 'use_get_out_of_jail_card',
  endTurn: 'end_turn',
  finishGameByTime: 'finish_game_by_time',
  finishGameAfterLastHumanLeft: 'finish_game_after_last_human_left',
} as const;

export const GAME_SOCKET_EVENTS = {
  authenticated: 'game:authenticated',
  join: 'game:join',
  joined: 'game:joined',
  rollAndMove: 'game:roll-and-move',
  buyProperty: 'game:buy-property',
  declinePropertyPurchase: 'game:decline-property-purchase',
  placeAuctionBid: 'game:place-auction-bid',
  passAuctionBid: 'game:pass-auction-bid',
  payDebt: 'game:pay-debt',
  payJailFine: 'game:pay-jail-fine',
  useGetOutOfJailCard: 'game:use-get-out-of-jail-card',
  declareBankruptcy: 'game:declare-bankruptcy',
  buildProperty: 'game:build-property',
  sellBuilding: 'game:sell-building',
  mortgageProperty: 'game:mortgage-property',
  unmortgageProperty: 'game:unmortgage-property',
  proposeTrade: 'game:propose-trade',
  acceptTrade: 'game:accept-trade',
  rejectTrade: 'game:reject-trade',
  cancelTrade: 'game:cancel-trade',
  endTurn: 'game:end-turn',
  state: 'game:state',
  events: 'game:events',
  eventsGet: 'game:events:get',
  eventsRecovered: 'game:events:recovered',
  heartbeat: 'game:heartbeat',
  heartbeatAcknowledged: 'game:heartbeat:acknowledged',
  presenceGet: 'game:presence:get',
  presence: 'game:presence',
  commandRejected: 'game:command-rejected',
  error: 'game:error',
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
  timerWatchdogCompleted: 'GameTimerWatchdogCompleted',
  timerWatchdogFailed: 'GameTimerWatchdogFailed',
  unknownJobReceived: 'GameUnknownJobReceived',
  realtimePublished: 'GameRealtimePublished',
  realtimePublishFailed: 'GameRealtimePublishFailed',
  leaderboardRefreshQueued: 'GameLeaderboardRefreshQueued',
  leaderboardRefreshQueueFailed: 'GameLeaderboardRefreshQueueFailed',
  leaderboardRefreshSucceeded: 'GameLeaderboardRefreshSucceeded',
  leaderboardRefreshFailed: 'GameLeaderboardRefreshFailed',
  userMatchHistoryCacheInvalidationFailed:
    'GameUserMatchHistoryCacheInvalidationFailed',
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
  timerWatchdogCompleted: 'Custom/Game/TimerWatchdog/Completed',
  timerWatchdogFailed: 'Custom/Game/TimerWatchdog/Failed',
  unknownJobReceived: 'Custom/Game/Job/Unknown',
  realtimePublished: 'Custom/Game/Realtime/Published',
  realtimePublishFailed: 'Custom/Game/Realtime/PublishFailed',
  leaderboardRefreshQueued: 'Custom/Game/Leaderboard/Refresh/Queued',
  leaderboardRefreshQueueFailed: 'Custom/Game/Leaderboard/Refresh/QueueFailed',
  leaderboardRefreshSucceeded: 'Custom/Game/Leaderboard/Refresh/Succeeded',
  leaderboardRefreshFailed: 'Custom/Game/Leaderboard/Refresh/Failed',
  userMatchHistoryCacheInvalidationFailed:
    'Custom/Game/UserMatchHistoryCacheInvalidation/Failed',
  commandSucceeded: (command: string) =>
    `Custom/Game/Command/Succeeded/${command}`,
  commandFailed: (command: string) => `Custom/Game/Command/Failed/${command}`,
} as const;
