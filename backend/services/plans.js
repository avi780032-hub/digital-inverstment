// Illustrative catalogue. Real products must come from licensed partners (AMC / broker / bank).
module.exports = [
  { key: 'tbill', name: 'T-Bill 364 days', category: 'Government Securities', returnPct: 6.9, tenureMonths: 12, minAmount: 1000, risk: 1, regulated: true, note: 'Sovereign-backed. Yield varies by auction.' },
  { key: 'gsec', name: 'Government Security 10Y', category: 'Government Securities', returnPct: 7.1, tenureMonths: 12, minAmount: 1000, risk: 1, regulated: true, note: 'Illustrative holding period shown. Prices move with interest rates.' },
  { key: 'liquid-mf', name: 'Liquid Mutual Fund', category: 'Mutual Fund', returnPct: 6.8, tenureMonths: 3, minAmount: 500, risk: 1, regulated: true, note: 'Market-linked. Shown return is an estimate, not a promise.' },
  { key: 'corp-bond', name: 'AAA Corporate Bond', category: 'Bonds', returnPct: 8.2, tenureMonths: 24, minAmount: 5000, risk: 2, regulated: true, note: 'Credit risk of the issuer applies.' },
  { key: 'index-mf', name: 'Nifty 50 Index Fund', category: 'Mutual Fund', returnPct: 11, tenureMonths: 36, minAmount: 500, risk: 3, regulated: true, note: 'Equity returns can be negative. Estimate based on long-term averages.' },
  { key: 'fixed-saver', name: 'Fixed Saver 8.5% (demo only)', category: 'Fixed Return', returnPct: 8.5, tenureMonths: 12, minAmount: 1000, risk: 1, regulated: false, note: 'Demo only. Guaranteed returns need a licensed bank/NBFC partner.' }
];
