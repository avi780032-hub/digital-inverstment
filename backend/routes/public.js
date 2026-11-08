const router = require('express').Router();
const plans = require('../services/plans');
const { fdRows } = require('../services/finance');
// No login needed: used by the public home page
router.get('/plans', (req, res) => res.json({ plans }));
router.get('/fd-compare', (req, res) => {
  const amount = Math.min(Number(req.query.amount) || 100000, 1e8), months = Math.min(Number(req.query.months) || 12, 120);
  res.json({ amount, months, rows: fdRows(amount, months) });
});
module.exports = router;
