const plans = require('./plans');
const { Transaction } = require('../models');

const maturityValue = (amount, pct, months) => Math.round(amount * Math.pow(1 + pct / 100, months / 12) * 100) / 100;
const currentValue = inv => {
  const total = inv.maturityDate - inv.startDate;
  const done = Math.min(Math.max(Date.now() - inv.startDate, 0), total);
  const accrued = (maturityValue(inv.amount, inv.returnPct, inv.tenureMonths) - inv.amount) * (done / total);
  return Math.round((inv.amount + accrued) * 100) / 100;
};

// Rule-based fraud check (replace with ML / bank risk engine later)
async function fraudCheck(userId, amount) {
  const recent = await Transaction.countDocuments({ user: userId, createdAt: { $gt: new Date(Date.now() - 10 * 60000) } });
  if (recent >= 8) return { high: true, reason: 'Too many transactions in 10 minutes' };
  return { high: false };
}

// Risk questionnaire: 5 answers, each 1-3
function riskProfile(answers) {
  const score = answers.reduce((a, b) => a + b, 0);
  const profile = score <= 8 ? 'conservative' : score <= 12 ? 'moderate' : 'aggressive';
  return { score, profile };
}
const picks = { conservative: ['tbill', 'liquid-mf', 'gsec'], moderate: ['corp-bond', 'gsec', 'liquid-mf'], aggressive: ['index-mf', 'corp-bond', 'gsec'] };
const recommend = profile => (picks[profile] || picks.conservative).map(k => plans.find(p => p.key === k));

// FD comparison rows. Bank rates are illustrative: refresh from a rates feed before launch.
function fdRows(amount, months) {
  const rows = [['SBI', 6.8], ['HDFC Bank', 7.0], ['ICICI Bank', 7.0], ['Axis Bank', 7.1], ['Bajaj Finance (NBFC)', 8.0]]
    .map(([bank, rate]) => ({ bank, rate, maturity: maturityValue(amount, rate, months) }));
  plans.filter(p => ['tbill', 'gsec', 'corp-bond'].includes(p.key)).forEach(p => rows.push({ bank: p.name, rate: p.returnPct, maturity: maturityValue(amount, p.returnPct, months) }));
  return rows.sort((a, b) => b.rate - a.rate);
}

module.exports = { fdRows, maturityValue, currentValue, fraudCheck, riskProfile, recommend };
