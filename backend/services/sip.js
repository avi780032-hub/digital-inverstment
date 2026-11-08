const { Sip, User } = require('../models');
const { createInvestment } = require('./invest');

// Runs one SIP instalment from the wallet. Skipped (and retried later) if the wallet is short.
async function runSip(sip) {
  const user = await User.findById(sip.user);
  try { await createInvestment(user, sip.planKey, sip.amount); sip.lastRun = new Date(); sip.lastStatus = 'Invested'; }
  catch (e) { sip.lastStatus = 'Skipped: ' + e.message; }
  await sip.save(); return sip.lastStatus;
}

async function processSips() {
  try {
    const now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const due = await Sip.find({ active: true, dayOfMonth: { $lte: now.getDate() }, $or: [{ lastRun: null }, { lastRun: { $lt: monthStart } }] });
    for (const s of due) await runSip(s);
    if (due.length) console.log(`Processed ${due.length} SIPs`);
  } catch (e) { console.error('SIP job failed', e.message); }
}
module.exports = { runSip, processSips };
