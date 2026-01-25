/**
 * Pure function to calculate net balances from expenses
 * @param {Array} expenses - Array of expense objects
 * @param {Array} participants - Array of participant names
 * @returns {Map} Map of participant name -> net balance
 */
export function calculateBalances(expenses, participants) {
  const balances = new Map();
  participants.forEach(p => balances.set(p, 0));

  expenses.forEach(exp => {
    const val = parseFloat(exp.amount);
    if (isNaN(val)) return;

    // Payer gets positive balance
    balances.set(exp.payer, (balances.get(exp.payer) || 0) + val);

    // Each beneficiary owes their share
    const split = val / exp.beneficiaries.length;
    exp.beneficiaries.forEach(b => {
      if (balances.has(b)) {
        balances.set(b, (balances.get(b) || 0) - split);
      }
    });
  });

  return balances;
}

/**
 * Calculate total spent across all expenses
 */
export function calculateTotalSpent(expenses) {
  return expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
}
