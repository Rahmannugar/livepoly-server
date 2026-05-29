export function withJitter(value: number, ratio = 0.2): number {
  if (value <= 0) {
    return value;
  }

  const boundedRatio = Math.max(0, Math.min(ratio, 1));
  const spread = value * boundedRatio;
  const min = value - spread;
  const max = value + spread;

  return Math.round(min + Math.random() * (max - min));
}

export function withTtlJitter(ttlSeconds: number, ratio = 0.15): number {
  return Math.max(1, withJitter(ttlSeconds, ratio));
}
