const router = require('express').Router();
const { Transaction } = require('../models');
const { wrap, fail, auth, verifiedContact, kycRequired, publicUser, ref } = require('../middleware');
const { fraudCheck } = require('../services/finance');
const { fire } = require('../services/notify');

const luhn = n => { let s = 0, d = false; for (let i = n.length - 1; i >= 0; i--) { let x = +n[i]; if (d) { x *= 2; if (x > 9) x -= 9; } s += x; d = !d; } return s % 10 === 0; };

// DEMO gateway. Production: create an order with Razorpay / Cashfree / PayU, verify the signed webhook, then credit the wallet.
router.post('/checkout', auth, verifiedContact, kycRequired, wrap(async (req, res) => {
  const { method } = req.body, a = Math.round(Number(req.body.amount) * 100) / 100, u = req.user;
  if (!Number.isFinite(a) || a < 100) throw fail(400, 'Minimum amount is Rs 100');
  let via;
  if (method === 'upi') {
    if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(req.body.upiId || '')) throw fail(400, 'UPI ID looks wrong. Example: name@okhdfc');
    via = 'UPI ' + req.body.upiId;
  } else if (method === 'netbanking') {
    const { bankName, accountNumber, ifsc } = req.body;
    if (!bankName || !/^\d{9,18}$/.test(accountNumber || '')) throw fail(400, 'Enter bank name and a valid account number');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test((ifsc || '').toUpperCase())) throw fail(400, 'IFSC looks wrong');
    via = `Net banking ${bankName} ****${accountNumber.slice(-4)}`;
    if (!u.bank.accountLast4) { // first bank payment links the account automatically
      u.bank = { bankName, ifsc: ifsc.toUpperCase(), accountLast4: accountNumber.slice(-4), balance: 150000 }; // demo balance
      u.kyc.bankOk = true;
    }
  } else if (method === 'card') {
    const c = req.body.card || {}, num = (c.number || '').replace(/\s/g, '');
    if (!/^\d{16}$/.test(num) || !luhn(num)) throw fail(400, 'Card number is not valid (demo card: 4111 1111 1111 1111)');
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(c.expiry || '')) throw fail(400, 'Expiry should look like 08/29');
    if (!/^\d{3}$/.test(c.cvv || '')) throw fail(400, 'CVV is 3 digits');
    via = 'Card ****' + num.slice(-4);
  } else throw fail(400, 'Choose a payment method');

  const f = await fraudCheck(u._id, a);
  if (f.high) { await Transaction.create({ user: u._id, type: 'deposit', amount: a, ref: ref('UTR'), note: f.reason, status: 'flagged' }); throw fail(403, 'Held for review: ' + f.reason); }

  u.wallet += a;
  const k = u.kyc; k.status = k.panOk && k.aadhaarOk && k.faceOk && k.bankOk ? 'verified' : 'pending';
  await u.save();
  const utr = ref('UTR');
  await Transaction.create({ user: u._id, type: 'deposit', amount: a, ref: utr, note: 'Paid via ' + via });
  fire(u, { subject: 'Money added to your wallet', text: `Rs ${a} was added to your Invest365 wallet via ${via}.\nBank reference: ${utr}.`, sms: `Invest365: Rs ${a} added to your wallet. Ref ${utr}.` });
  res.json({ user: publicUser(u), receipt: { ref: utr, amount: a, via, at: new Date() } });
}));

// ---- Razorpay (works with test keys, no real money). Fill RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env to switch it on.
const crypto = require('crypto');
const KEY = () => process.env.RAZORPAY_KEY_ID, SECRET = () => process.env.RAZORPAY_KEY_SECRET;
const rzp = async (path, method = 'GET', body) => {
  const r = await fetch('https://api.razorpay.com/v1' + path, { method, body: body && JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(KEY() + ':' + SECRET()).toString('base64') } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw fail(502, (d.error && d.error.description) || 'Payment gateway error');
  return d;
};
router.get('/config', auth, (req, res) => res.json({ razorpay: !!(KEY() && SECRET()), keyId: KEY() || null }));

router.post('/razorpay/order', auth, verifiedContact, kycRequired, wrap(async (req, res) => {
  if (!KEY() || !SECRET()) throw fail(400, 'Razorpay is not set up on the server');
  const a = Math.round(Number(req.body.amount) * 100) / 100;
  if (!Number.isFinite(a) || a < 100) throw fail(400, 'Minimum amount is Rs 100');
  const f = await fraudCheck(req.user._id, a); if (f.high) throw fail(403, 'Held for review: ' + f.reason);
  const o = await rzp('/orders', 'POST', { amount: Math.round(a * 100), currency: 'INR', receipt: 'i365_' + Date.now(), notes: { userId: String(req.user._id) } });
  res.json({ orderId: o.id, amount: o.amount, keyId: KEY() });
}));

router.post('/razorpay/verify', auth, wrap(async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  if (!orderId || !paymentId || !signature) throw fail(400, 'Missing payment details');
  const expected = crypto.createHmac('sha256', SECRET()).update(orderId + '|' + paymentId).digest('hex');
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) throw fail(400, 'Payment could not be verified');
  if (await Transaction.findOne({ ref: paymentId })) throw fail(409, 'This payment is already credited');
  const o = await rzp('/orders/' + orderId); // amount comes from Razorpay, never from the browser
  if (!o.notes || o.notes.userId !== String(req.user._id)) throw fail(403, 'This order belongs to another account');
  if (o.status !== 'paid') throw fail(400, 'Payment is not completed yet');
  const a = o.amount / 100, u = req.user;
  u.wallet += a; await u.save();
  await Transaction.create({ user: u._id, type: 'deposit', amount: a, ref: paymentId, note: 'Paid via Razorpay (test mode)' });
  fire(u, { subject: 'Money added to your wallet', text: `Rs ${a} was added to your Invest365 wallet via Razorpay.\nPayment ID: ${paymentId}.`, sms: `Invest365: Rs ${a} added to your wallet. Ref ${paymentId}.` });
  res.json({ user: publicUser(u), receipt: { ref: paymentId, amount: a, via: 'Razorpay (test mode)', at: new Date() } });
}));

module.exports = router;
