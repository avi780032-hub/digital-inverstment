const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User } = require('../models');
const { wrap, fail, auth, sign, publicUser } = require('../middleware');
const { notify, fire } = require('../services/notify');

router.post('/register', wrap(async (req, res) => {
  const { name, mobile, email, password } = req.body;
  if (!name || !/^[6-9]\d{9}$/.test(mobile || '')) throw fail(400, 'Enter your name and a valid 10-digit mobile number');
  if (!/^\S+@\S+\.\S+$/.test(email || '')) throw fail(400, 'Enter a valid email');
  if ((password || '').length < 8) throw fail(400, 'Password must be at least 8 characters');
  if (await User.findOne({ $or: [{ email }, { mobile }] })) throw fail(409, 'Email or mobile already registered');
  const accountNo = '365' + String(Math.floor(1e8 + Math.random() * 9e8));
  const user = await User.create({ accountNo, name, mobile, email: email.toLowerCase(), password: await bcrypt.hash(password, 10) });
  fire(user, { channels: ['email'], subject: 'Welcome to Invest365', text: `Hi ${name}, your Invest365 account is ready.\nAccount number: ${accountNo}\nNext step: complete KYC to start investing.` });
  res.json({ token: sign(user), user: publicUser(user) });
}));

router.post('/login', wrap(async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) throw fail(401, 'Wrong email or password');
  res.json({ token: sign(user), user: publicUser(user) });
}));

// OTP login. In production send the code through an SMS provider (MSG91, Twilio, etc.)
router.post('/otp/send', wrap(async (req, res) => {
  const user = await User.findOne({ mobile: req.body.mobile });
  if (!user) throw fail(404, 'No account with this mobile number');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  user.otp = { code, expires: new Date(Date.now() + 5 * 60000) }; await user.save();
  const sent = await notify(user, { subject: 'Your Invest365 login code', text: `Your Invest365 OTP is ${code}. It is valid for 5 minutes. Do not share it with anyone.` });
  const delivered = sent.email || sent.sms;
  res.json({ ok: true, sentTo: { email: sent.email, sms: sent.sms }, ...(!delivered && process.env.NODE_ENV !== 'production' && { devOtp: code }) });
}));

router.post('/otp/verify', wrap(async (req, res) => {
  const user = await User.findOne({ mobile: req.body.mobile });
  if (!user || !user.otp || user.otp.code !== req.body.otp || user.otp.expires < new Date()) throw fail(401, 'Invalid or expired OTP');
  user.otp = undefined; await user.save();
  res.json({ token: sign(user), user: publicUser(user) });
}));

// ---- Verify email and mobile (codes valid 10 minutes, 5 tries, 30 seconds between sends, stored as hashes)
const vHash = (code, u, ch) => crypto.createHash('sha256').update(`${code}:${u._id}:${ch}:${process.env.JWT_SECRET}`).digest('hex');
const maskEmail = e => e.replace(/^(.{2}).*(@.*)$/, '$1***$2'), maskMobile = m => m.slice(0, 2) + '*****' + m.slice(-2);
const channelOf = b => { if (!['email', 'mobile'].includes(b.channel)) throw fail(400, 'Choose email or mobile'); return b.channel; };

router.post('/verify/send', auth, wrap(async (req, res) => {
  const ch = channelOf(req.body), u = req.user;
  if (ch === 'email' ? u.emailVerified : u.mobileVerified) throw fail(400, 'Already verified');
  const prev = u.verifyOtp && u.verifyOtp[ch];
  if (prev && prev.sentAt && Date.now() - prev.sentAt < 30000) throw fail(429, 'Please wait 30 seconds before asking for a new code');
  const code = String(crypto.randomInt(100000, 1000000));
  u.set('verifyOtp.' + ch, { hash: vHash(code, u, ch), expires: new Date(Date.now() + 10 * 60000), tries: 0, sentAt: new Date() }); await u.save();
  const sent = await notify(u, { channels: [ch === 'email' ? 'email' : 'sms'], subject: `Verify your Invest365 ${ch}`, text: `Your Invest365 ${ch} verification code is ${code}. It is valid for 10 minutes. Do not share it.` });
  const ok = ch === 'email' ? sent.email : sent.sms;
  res.json({ ok: true, sentTo: ok ? (ch === 'email' ? maskEmail(u.email) : maskMobile(u.mobile)) : null, ...(!ok && process.env.NODE_ENV !== 'production' && { devOtp: code }) });
}));

router.post('/verify/confirm', auth, wrap(async (req, res) => {
  const ch = channelOf(req.body), u = req.user, o = u.verifyOtp && u.verifyOtp[ch];
  if (!o || !o.hash) throw fail(400, 'Request a code first');
  if (o.expires < new Date()) { u.set('verifyOtp.' + ch, undefined); await u.save(); throw fail(400, 'Code expired. Request a new one'); }
  if (o.tries >= 5) { u.set('verifyOtp.' + ch, undefined); await u.save(); throw fail(429, 'Too many wrong attempts. Request a new code'); }
  if (!crypto.timingSafeEqual(Buffer.from(vHash(String(req.body.otp || ''), u, ch)), Buffer.from(o.hash))) { u.set(`verifyOtp.${ch}.tries`, o.tries + 1); await u.save(); throw fail(400, 'Wrong code'); }
  u.set(ch === 'email' ? 'emailVerified' : 'mobileVerified', true); u.set('verifyOtp.' + ch, undefined); await u.save();
  res.json({ user: publicUser(u) });
}));

router.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
module.exports = router;
