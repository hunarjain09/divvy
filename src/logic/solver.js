/**
 * Wrapper for LP-solver to generate settlement plan
 */
export function generateSettlementPlan(balances, strangers, isStrangerFn) {
  // Check if solver is available
  if (typeof window === 'undefined' || !window.solver) {
    return [];
  }

  const people = [];
  const netAmounts = {};

  balances.forEach((val, name) => {
    if (Math.abs(val) > 0.01) {
      people.push(name);
      netAmounts[name] = Math.round(val * 100);
    }
  });

  const debtors = people.filter(p => netAmounts[p] < 0);
  const creditors = people.filter(p => netAmounts[p] > 0);

  if (debtors.length === 0 && creditors.length === 0) return [];

  // Build LP model
  const model = {
    optimize: 'cost',
    opType: 'min',
    constraints: {},
    variables: {},
    ints: {},
  };

  // Flow conservation constraints
  people.forEach(p => {
    model.constraints[p] = { equal: netAmounts[p] };
  });

  const bigM = 10000000;

  // Create transfer and arc variables
  debtors.forEach(d => {
    creditors.forEach(c => {
      const isStr = isStrangerFn(d, c);
      const cost = isStr ? 10000 : 1;
      const tVar = `T_${d}_${c}`;
      const aVar = `A_${d}_${c}`;

      model.variables[tVar] = {
        [d]: -1,
        [c]: 1,
        [`link_${d}_${c}`]: 1,
        cost: 0,
      };
      model.variables[aVar] = {
        cost: cost,
        [`link_${d}_${c}`]: -bigM,
      };
      model.ints[aVar] = 1;
      model.constraints[`link_${d}_${c}`] = { max: 0 };
    });
  });

  try {
    const result = window.solver.Solve(model);
    const plan = [];

    Object.keys(result).forEach(k => {
      if (k.startsWith('T_') && result[k] > 0) {
        const [, from, to] = k.split('_');
        plan.push({
          from,
          to,
          amount: result[k] / 100,
          isStranger: isStrangerFn(from, to),
        });
      }
    });

    return plan;
  } catch (e) {
    console.error('Solver error:', e);
    return [];
  }
}
