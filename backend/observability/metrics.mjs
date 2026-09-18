const counters = new Map();

export function increment(name, value = 1, labels = {}) {
  const key = `${name}:${JSON.stringify(labels)}`;
  counters.set(key, (counters.get(key) || 0) + value);
}

export function snapshot() {
  return Object.fromEntries(counters.entries());
}

export function reset() { counters.clear(); }
