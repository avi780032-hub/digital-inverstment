const plans = require('./plans');
const { Investment, Transaction } = require('../models');
const { fail, ref } = require('../middleware');
const { fire } = require('./notify');

async function createInvestment(user, planKey, amount, goal) {
  const plan = plans.find(p => p.key === planKey);
  if (!plan) throw fail(404, 'Plan not found');
  if (!(amount >= plan.minAmount)) throw fail(400, `Minimum amount is Rs ${plan.minAmount}`);
  if (user.wallet < amount) throw fail(400, 'Not enough wallet balance. Add money first.');
  user.wallet -= amount; await user.save();
  const start = new Date(), end = new Date(start); end.setMonth(end.getMonth() + plan.tenureMonths);
  const inv = await Investment.create({ user: user._id, planKey, planName: plan.name, category: plan.category, amount,
    returnPct: plan.returnPct, tenureMonths: plan.tenureMonths, startDate: start, maturityDate: end, goal: goal || undefined });
  await Transaction.create({ user: user._id, type: 'investment', amount, ref: ref('INV'), note: plan.name });
  fire(user, { channels: ['email'], subject: 'Investment confirmed', text: `You invested Rs ${amount} in ${plan.name}.\nExpected maturity date: ${end.toDateString()}.` });
  return inv;
}
module.exports = { createInvestment };
