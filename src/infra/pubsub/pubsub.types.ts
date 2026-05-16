export type PubSubPayload = Record<string, unknown>;

export type PubSubClient = {
  publish(channel: string, payload: PubSubPayload): Promise<void>;
};
