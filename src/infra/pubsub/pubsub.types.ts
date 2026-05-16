export type PubSubPayload = Record<string, unknown>;

export type PubSubMessageHandler = (payload: PubSubPayload) => void;

export type PubSubSubscription = {
  unsubscribe(): Promise<void>;
};

export type PubSubClient = {
  publish(channel: string, payload: PubSubPayload): Promise<void>;
  subscribe(
    channel: string,
    handler: PubSubMessageHandler,
  ): Promise<PubSubSubscription>;
};
