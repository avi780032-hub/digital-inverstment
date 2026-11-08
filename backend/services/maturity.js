const { Investment, Transaction, User } = require('../models');
const { maturityValue } = require('./finance');
const { ref } = require('../middleware');
const { fire } = require('./notify');

// Credits payout to wallet for every investment that has reached maturity
async function processMaturities() {
  try {
    const due = await Investment.find({ status: 'active', maturityDate: { $lte: new Date() } });
    for (const inv of due) {
      const payout = maturityValue(inv.amount, inv.returnPct, inv.tenureMonths);
      await User.updateOne({ _id: inv.user }, { $inc: { wallet: payout } });
      await Transaction.create({ user: inv.user, type: 'interest', amount: Math.round((payout - inv.amount) * 100) / 100, ref: ref('INT'), note: inv.planName + ' interest' });
      await Transaction.create({ user: inv.user, type: 'redemption', amount: inv.amount, ref: ref('RED'), note: inv.planName + ' principal' });
      inv.status = 'matured'; inv.payout = payout; await inv.save();
      const owner = await User.findById(inv.user);
      if (owner) fire(owner, { subject: 'Your investment has matured', text: `${inv.planName} has matured. Rs ${payout} was credited to your Invest365 wallet.`, sms: `Invest365: ${inv.planName} matured. Rs ${payout} credited to your wallet.` });
    }
    if (due.length) console.log(`Matured ${due.length} investments`);
  } catch (e) { console.error('Maturity job failed', e.message); }
}
module.exports = { processMaturities };
