/**
 * Normalize pair key for strangers (bidirectional)
 */
export function normalizePairKey(name1, name2) {
  return [name1, name2].sort().join('|');
}

/**
 * Check if two people are strangers
 */
export function isStranger(name1, name2, strangers) {
  const key = normalizePairKey(name1, name2);
  return strangers.has(key);
}

/**
 * Add or remove a stranger relationship
 */
export function toggleStranger(name1, name2, strangers) {
  if (!name1 || !name2 || name1 === name2) return strangers;

  const key = normalizePairKey(name1, name2);
  const nextStrangers = new Set(strangers);

  if (nextStrangers.has(key)) {
    nextStrangers.delete(key);
  } else {
    nextStrangers.add(key);
  }

  return nextStrangers;
}
