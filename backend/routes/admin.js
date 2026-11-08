const router = require('express').Router();
const { User, Investment, Transaction } = require('../models');
const { wrap, auth, admin } = require('../middleware');
const { maturityValue } = require('../services/finance');
const { processMaturities } = require('../services/maturity');

router.use(auth, admin);

router.get('/stats', wrap(async (req, res) => {
  const [users, kycDone, active, all, interestTx, flagged] = await Promise.all([
    User.countDocuments({ role: 'user' }), User.countDocuments({ 'kyc.status': 'verified' }),
    Investment.find({ status: 'active' }), Investment.find(),
    Transaction.aggregate([{ $match: { type: 'interest' } }, { $group: { _id: null, t: { $sum: '$amount' } } }]),
    Transaction.countDocuments({ status: 'flagged' })
  ]);
  const aum = active.reduce((s, i) => s + i.amount, 0);
  const liability = active.reduce((s, i) => s + maturityValue(i.amount, i.returnPct, i.tenureMonths) - i.amount, 0);
  const soon = new Date(Date.now() + 30 * 86400000);
  const maturing = active.filter(i => i.maturityDate <= soon);
  const byPlan = {}; all.forEach(i => { byPlan[i.planName] = (byPlan[i.planName] || 0) + i.amount; });
  res.json({ users, kycDone, totalInvested: all.reduce((s, i) => s + i.amount, 0), aum, activeCount: active.length,
    interestPaid: (interestTx[0] && interestTx[0].t) || 0, projectedInterestLiability: Math.round(liability * 100) / 100,
    maturingSoon: maturing.length, maturingAmount: maturing.reduce((s, i) => s + i.amount, 0), flagged, byPlan });
}));

router.get('/series', wrap(async (req, res) => {
  const since = new Date(Date.now() - 13 * 86400000); since.setUTCHours(0, 0, 0, 0);
  const grp = f => ({ _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, v: f });
  const [dep, usr] = await Promise.all([
    Transaction.aggregate([{ $match: { type: 'deposit', status: 'success', createdAt: { $gte: since } } }, { $group: grp({ $sum: '$amount' }) }]),
    User.aggregate([{ $match: { role: 'user', createdAt: { $gte: since } } }, { $group: grp({ $sum: 1 }) }])
  ]);
  const days = [...Array(14)].map((_, i) => new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10));
  const pick = (rows, d) => (rows.find(r => r._id === d) || { v: 0 }).v;
  res.json({ deposits: days.map(d => ({ label: d.slice(5), value: pick(dep, d) })), signups: days.map(d => ({ label: d.slice(5), value: pick(usr, d) })) });
}));

router.get('/users', wrap(async (req, res) => res.json({ users: await User.find({ role: 'user' }).select('-password -otp').sort('-createdAt').limit(200) })));
router.get('/maturities', wrap(async (req, res) => res.json({ investments: await Investment.find({ status: 'active' }).sort('maturityDate').limit(100).populate('user', 'name mobile') })));
router.get('/flagged', wrap(async (req, res) => res.json({ transactions: await Transaction.find({ status: 'flagged' }).sort('-createdAt').populate('user', 'name mobile') })));

// Demo helper: pull every active investment's maturity to now, then run the job
router.post('/fast-forward', wrap(async (req, res) => {
  await Investment.updateMany({ status: 'active' }, { maturityDate: new Date(Date.now() - 1000) });
  await processMaturities(); res.json({ ok: true });
}));

module.exports = router;
