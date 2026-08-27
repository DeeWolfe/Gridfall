// Progression vocabulary: card tiers, commander ranks, and card veterancy.
// Not part of gridfall-data.json — these are presentation ladders rather than
// balance numbers, and nothing outside the UI reads them.

export const TIERNAME = {common: 'Common', tech: 'Tech', special: 'Specialist'};

export const RANKS = ['Recruit', 'Corporal', 'Sergeant', 'Lieutenant', 'Captain', 'Commander'];

// A card's rank climbs with how many times it has been deployed across the
// whole profile. `at` is the deployment count that unlocks the tier.
export const VET = [
  {n: 'Standard', at: 0, col: '#8d9bbd'},
  {n: 'Veteran', at: 10, col: '#b8c4dd'},
  {n: 'Elite', at: 30, col: '#ffc94d'},
  {n: 'Legend', at: 75, col: '#9d6bff'},
];
