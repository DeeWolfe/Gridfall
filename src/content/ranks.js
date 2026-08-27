// Progression vocabulary: card tiers, commander ranks, and card veterancy.
// Not part of gridfall-data.json — these are presentation ladders rather than
// balance numbers, and nothing outside the UI reads them.

export const TIERNAME = {common: 'Common', tech: 'Tech', special: 'Specialist'};

// The player commands the whole task force; a team lead runs the squad under
// them. The ladder therefore starts at command tier, not at enlisted ranks.
export const RANKS = ['Acting Commander', 'Commander', 'Senior Commander',
  'Task Force Commander', 'Operations Director', 'Marshal'];

// A card's rank climbs with how many times it has been deployed across the
// whole profile. `at` is the deployment count that unlocks the tier.
export const VET = [
  {n: 'Standard', at: 0, col: '#8d9bbd'},
  {n: 'Veteran', at: 10, col: '#b8c4dd'},
  {n: 'Elite', at: 30, col: '#ffc94d'},
  {n: 'Legend', at: 75, col: '#9d6bff'},
];
