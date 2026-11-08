const router = require('express').Router();
const crypto = require('crypto');
const { Transaction, Investment } = require('../models');
const { wrap, fail, auth, kycRequired, verifiedContact, publicUser, ref } = require('../middleware');
const { fraudCheck, recommend, currentValue } = require('../services/finance');
const { createInvestment } = require('../services/invest');
const { finish } = require('./kyc');
const { notify, fire } = require('../services/notify');

router.use(auth);
const amt = v => { const n = Number(v); if (!(n > 0)) throw fail(400, 'Enter a valid amount'); return Math.round(n * 100) / 100; };

// Link account. Production: Account Aggregator (Finvu, OneMoney, Anumati) + penny-drop verification
router.post('/link', wrap(async (req, res) => {
  const { bankName, accountNumber, ifsc } = req.body;
  if (!bankName || !/^\d{9,18}$/.test(accountNumber || '')) throw fail(400, 'Enter bank name and a valid account number');
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test((ifsc || '').toUpperCase())) throw fail(400, 'IFSC looks wrong');
  const u = req.user;
  u.bank = { bankName, ifsc: ifsc.toUpperCase(), accountLast4: accountNumber.slice(-4), balance: u.bank.balance || 150000 }; // demo balance
  u.kyc.bankOk = true;
  await finish(u, res);
}));

router.get('/balance', wrap(async (req, res) => res.json({ bank: req.user.bank, wallet: req.user.wallet })));

router.post('/deposit', kycRequired, wrap(async (req, res) => {
  const a = amt(req.body.amount), u = req.user;
  const f = await fraudCheck(u._id, a);
  if (f.high) { await Transaction.create({ user: u._id, type: 'deposit', amount: a, ref: ref('DEP'), note: f.reason, status: 'flagged' }); throw fail(403, 'Held for review: ' + f.reason); }
  if (u.bank.balance < a) throw fail(400, 'Not enough balance in your bank account');
  u.bank.balance -= a; u.wallet += a; await u.save();
  await Transaction.create({ user: u._id, type: 'deposit', amount: a, ref: ref('DEP'), note: `From ${u.bank.bankName} ****${u.bank.accountLast4}` });
  res.json({ user: publicUser(u) });
}));

// Withdraw any amount. If the wallet is short, investments are exited early (principal + half of interest earned so far),
// liquid funds first, then the ones maturing soonest.
async function planWithdrawal(u, a) {
  const short = Math.max(0, Math.round((a - u.wallet) * 100) / 100), steps = []; let got = 0;
  if (short > 0) {
    const invs = await Investment.find({ user: u._id, status: 'active' });
    const rank = i => (i.planKey === 'liquid-mf' ? 0 : 1);
    invs.sort((x, y) => rank(x) - rank(y) || x.maturityDate - y.maturityDate);
    for (const inv of invs) {
      if (got >= short) break;
      const payout = Math.round((inv.amount + (currentValue(inv) - inv.amount) * 0.5) * 100) / 100;
      steps.push({ inv, payout }); got += payout;
    }
  }
  return { short, steps, possible: u.wallet + got >= a - 0.001 };
}
const checkBank = u => { if (!u.bank.accountLast4) throw fail(400, 'Link your bank account first'); };

// ---- Withdrawal verification: OTP by email and SMS, valid 5 minutes, 5 tries, one amount, one use
const otpHash = (code, u) => crypto.createHash('sha256').update(`${code}:${u._id}:${process.env.JWT_SECRET}`).digest('hex');
const maskEmail = e => e.replace(/^(.{2}).*(@.*)$/, '$1***$2');
const maskMobile = m => m.slice(0, 2) + '*****' + m.slice(-2);
async function checkWithdrawOtp(u, a, code) {
  const o = u.wdOtp;
  if (!o || !o.hash) throw fail(400, 'Request an OTP first');
  if (o.expires < new Date()) { u.wdOtp = undefined; await u.save(); throw fail(400, 'OTP expired. Request a new one'); }
  if (o.amount !== a) throw fail(400, 'This OTP was sent for a different amount. Request a new one');
  if (o.tries >= 5) { u.wdOtp = undefined; await u.save(); throw fail(429, 'Too many wrong attempts. Request a new OTP'); }
  if (!crypto.timingSafeEqual(Buffer.from(otpHash(String(code || ''), u)), Buffer.from(o.hash))) { u.set('wdOtp.tries', o.tries + 1); await u.save(); throw fail(400, 'Wrong OTP'); }
  u.wdOtp = undefined; // single use
}

router.post('/withdraw/request', verifiedContact, kycRequired, wrap(async (req, res) => {
  const a = amt(req.body.amount), u = req.user; checkBank(u);
  const p = await planWithdrawal(u, a);
  if (!p.possible) throw fail(400, 'Not enough money in wallet and investments together');
  if (u.wdOtp && u.wdOtp.sentAt && Date.now() - u.wdOtp.sentAt < 30000) throw fail(429, 'Please wait 30 seconds before asking for a new OTP');
  const code = String(crypto.randomInt(100000, 1000000));
  u.wdOtp = { hash: otpHash(code, u), expires: new Date(Date.now() + 5 * 60000), amount: a, tries: 0, sentAt: new Date() };
  await u.save();
  const sent = await notify(u, { subject: 'Invest365 withdrawal code', text: `Your Invest365 OTP to withdraw Rs ${a} is ${code}. It is valid for 5 minutes. If this was not you, do not share it and change your password.` });
  res.json({ ok: true, sentTo: { email: sent.email ? maskEmail(u.email) : null, sms: sent.sms ? maskMobile(u.mobile) : null },
    ...(!(sent.email || sent.sms) && process.env.NODE_ENV !== 'production' && { devOtp: code }) });
}));

router.get('/withdraw-preview', kycRequired, wrap(async (req, res) => {
  const a = amt(req.query.amount); checkBank(req.user);
  const p = await planWithdrawal(req.user, a);
  res.json({ wallet: req.user.wallet, short: p.short, possible: p.possible, redeem: p.steps.map(x => ({ planName: x.inv.planName, amount: x.inv.amount, payout: x.payout })) });
}));

router.post('/withdraw', kycRequired, wrap(async (req, res) => {
  const a = amt(req.body.amount), u = req.user; checkBank(u);
  const p = await planWithdrawal(u, a);
  if (p.short > 0 && !req.body.useInvestments) throw fail(400, 'Not enough wallet balance');
  if (!p.possible) throw fail(400, 'Not enough money in wallet and investments together');
  await checkWithdrawOtp(u, a, req.body.otp);
  for (const { inv, payout } of p.steps) {
    u.wallet += payout; inv.status = 'redeemed'; inv.payout = payout; await inv.save();
    await Transaction.create({ user: u._id, type: 'redemption', amount: payout, ref: ref('RED'), note: inv.planName + ' (early exit for withdrawal)' });
  }
  u.wallet = Math.round((u.wallet - a) * 100) / 100; u.bank.balance += a; await u.save();
  await Transaction.create({ user: u._id, type: 'withdrawal', amount: a, ref: ref('WDR'), note: `To ${u.bank.bankName} ****${u.bank.accountLast4}` });
  fire(u, { subject: 'Withdrawal requested', text: `Rs ${a} is on its way to ${u.bank.bankName} ****${u.bank.accountLast4}.`, sms: `Invest365: Rs ${a} withdrawn to ${u.bank.bankName} ****${u.bank.accountLast4}.` });
  res.json({ user: publicUser(u) });
}));

router.put('/sweep', wrap(async (req, res) => {
  const { enabled } = req.body, savePct = Number(req.body.savePct), investPct = Number(req.body.investPct);
  if (!(savePct >= 0) || !(investPct >= 0) || savePct + investPct > 90) throw fail(400, 'Save + invest cannot exceed 90%');
  req.user.sweep = { enabled: !!enabled, savePct, investPct }; await req.user.save();
  res.json({ user: publicUser(req.user) });
}));

// Simulates a salary credit. Production: UPI AutoPay / AA data triggers the same logic.
router.post('/salary', kycRequired, wrap(async (req, res) => {
  const a = amt(req.body.amount), u = req.user;
  u.bank.balance += a;
  await Transaction.create({ user: u._id, type: 'salary', amount: a, ref: ref('SAL'), note: 'Salary credited to bank' });
  let result = { saved: 0, invested: 0 };
  if (u.sweep.enabled) {
    const save = Math.round(a * u.sweep.savePct) / 100, inv = Math.round(a * u.sweep.investPct) / 100;
    u.bank.balance -= save + inv; u.wallet += save + inv;
    await Transaction.create({ user: u._id, type: 'saving', amount: save, ref: ref('SAV'), note: `Auto-save ${u.sweep.savePct}%` });
    await u.save(); result.saved = save;
    const plan = recommend(u.risk && u.risk.profile)[0]; // plan that fits the user's risk profile
    if (inv >= plan.minAmount) { await createInvestment(u, plan.key, inv); result.invested = inv; }
  } else await u.save();
  res.json({ user: publicUser(u), result });
}));

router.get('/transactions', wrap(async (req, res) => {
  const q = { user: req.user._id }; if (req.query.type) q.type = req.query.type;
  res.json({ transactions: await Transaction.find(q).sort('-createdAt').limit(200) });
}));

module.exports = router;
