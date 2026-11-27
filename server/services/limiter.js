// Tiny in-memory sliding-window limiter. Returns false when `key` exceeded `max` hits in `windowMs`.
const hits = new Map();
module.exports = (key, max, windowMs) => {
  const now = Date.now(), a = (hits.get(key) || []).filter(t => now - t < windowMs); a.push(now); hits.set(key, a);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return a.length <= max;
};
