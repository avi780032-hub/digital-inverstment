const router = require('express').Router();
const plans = require('../services/plans');
const { User, Investment, Transaction, Goal, Sip } = require('../models');
const { runSip } = require('../services/sip');
const { wrap, fail, auth, kycRequired, publicUser, ref } = require('../middleware');
const { maturityValue, currentValue, riskProfile, recommend } = require('../services/finance');
const { createInvestment } = require('../services/invest');

router.use(auth);
router.get('/plans', (req, res) => res.json({ plans }));

router.post('/risk', wrap(async (req, res) => {
  const a = req.body.answers;
  if (!Array.isArray(a) || a.length !== 5 || a.some(x => ![1, 2, 3].includes(x))) throw fail(400, 'Answer all 5 questions');
  req.user.risk = riskProfile(a); await req.user.save();
  res.json({ risk: req.user.risk, recommended: recommend(req.user.risk.profile) });
}));
router.get('/recommend', (req, res) => {
  const profile = (req.user.risk && req.user.risk.profile) || 'conservative';
  res.json({ profile, recommended: recommend(profile) });
});

router.post('/', kycRequired, wrap(async (req, res) => {
  const inv = await createInvestment(req.user, req.body.planKey, Number(req.body.amount), req.body.goal);
  res.json({ investment: inv, user: publicUser(req.user) });
}));

router.get('/', wrap(async (req, res) => {
  const list = await Investment.find({ user: req.user._id }).sort('-createdAt');
  res.json({ investments: list.map(i => ({ ...i.toObject(), currentValue: i.status === 'active' ? currentValue(i) : (i.payout || i.amount),
    maturityValue: maturityValue(i.amount, i.returnPct, i.tenureMonths) })) });
}));

router.get('/portfolio', wrap(async (req, res) => {
  const list = await Investment.find({ user: req.user._id, status: 'active' });
  const invested = list.reduce((s, i) => s + i.amount, 0), value = list.reduce((s, i) => s + currentValue(i), 0);
  const byCategory = {}; list.forEach(i => { byCategory[i.category] = (byCategory[i.category] || 0) + i.amount; });
  res.json({ invested, value, gain: Math.round((value - invested) * 100) / 100, byCategory, count: list.length });
}));

// Goals (declared before /:id routes)
router.get('/goals', wrap(async (req, res) => {
  const goals = await Goal.find({ user: req.user._id });
  const invs = await Investment.find({ user: req.user._id, goal: { $in: goals.map(g => g._id) }, status: { $ne: 'redeemed' } });
  res.json({ goals: goals.map(g => ({ ...g.toObject(), saved: invs.filter(i => String(i.goal) === String(g._id)).reduce((s, i) => s + (i.status === 'active' ? currentValue(i) : i.payout), 0) })) });
}));
router.post('/goals', wrap(async (req, res) => {
  const { name, icon, target, targetDate } = req.body;
  if (!name || !(Number(target) > 0)) throw fail(400, 'Goal needs a name and a target amount');
  res.json({ goal: await Goal.create({ user: req.user._id, name, icon, target: Number(target), targetDate: targetDate || undefined }) });
}));
router.delete('/goals/:id', wrap(async (req, res) => { await Goal.deleteOne({ _id: req.params.id, user: req.user._id }); res.json({ ok: true }); }));

// SIP: fixed amount into a plan on a chosen day each month (1-28), paid from the wallet
router.get('/sips', wrap(async (req, res) => res.json({ sips: await Sip.find({ user: req.user._id }).sort('-createdAt') })));
router.post('/sips', kycRequired, wrap(async (req, res) => {
  const plan = plans.find(p => p.key === req.body.planKey); if (!plan) throw fail(404, 'Plan not found');
  const a = Number(req.body.amount), d = Number(req.body.dayOfMonth), now = new Date();
  if (!(a >= plan.minAmount)) throw fail(400, `Minimum is Rs ${plan.minAmount}`);
  if (!(d >= 1 && d <= 28)) throw fail(400, 'Pick a day between 1 and 28');
  res.json({ sip: await Sip.create({ user: req.user._id, planKey: plan.key, planName: plan.name, amount: a, dayOfMonth: d, lastRun: d <= now.getDate() ? now : undefined }) });
}));
const mySip = async req => { const s = await Sip.findOne({ _id: req.params.id, user: req.user._id }); if (!s) throw fail(404, 'SIP not found'); return s; };
router.post('/sips/:id/toggle', wrap(async (req, res) => { const s = await mySip(req); s.active = !s.active; await s.save(); res.json({ sip: s }); }));
router.post('/sips/:id/run', kycRequired, wrap(async (req, res) => { const s = await mySip(req); const status = await runSip(s); res.json({ status, user: publicUser(await User.findById(req.user._id)) }); }));
router.delete('/sips/:id', wrap(async (req, res) => { await mySip(req); await Sip.deleteOne({ _id: req.params.id }); res.json({ ok: true }); }));

// Portfolio growth: monthly points from the first investment, projected to the last maturity (max 3 years ahead)
router.get('/growth', wrap(async (req, res) => {
  const invs = await Investment.find({ user: req.user._id, status: { $ne: 'redeemed' } });
  if (!invs.length) return res.json({ points: [] });
  const month = 30 * 86400000, now = Date.now();
  const first = Math.min(...invs.map(i => +i.startDate)), last = Math.min(Math.max(...invs.map(i => +i.maturityDate)), now + 3 * 365 * 86400000);
  const end = Math.max(last, now), points = [];
  for (let t = first, n = 0; t <= end + month && n < 60; t += month, n++) {
    let invested = 0, value = 0;
    for (const i of invs) {
      const s = +i.startDate, m = +i.maturityDate; if (t < s) continue;
      const mv = maturityValue(i.amount, i.returnPct, i.tenureMonths); invested += i.amount;
      value += t >= m ? mv : i.amount + (mv - i.amount) * (t - s) / (m - s);
    }
    points.push({ t, invested: Math.round(invested), value: Math.round(value), future: t > now });
  }
  res.json({ points });
}));

// Early exit: principal + half of accrued interest
router.post('/:id/redeem', wrap(async (req, res) => {
  const inv = await Investment.findOne({ _id: req.params.id, user: req.user._id });
  if (!inv || inv.status !== 'active') throw fail(404, 'Active investment not found');
  const accrued = currentValue(inv) - inv.amount, payout = Math.round((inv.amount + accrued * 0.5) * 100) / 100;
  req.user.wallet += payout; await req.user.save();
  inv.status = 'redeemed'; inv.payout = payout; await inv.save();
  await Transaction.create({ user: req.user._id, type: 'redemption', amount: payout, ref: ref('RED'), note: inv.planName + ' (early exit)' });
  res.json({ payout, user: publicUser(req.user) });
}));

module.exports = router;
