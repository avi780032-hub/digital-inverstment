const jwt = require('jsonwebtoken');
const { User } = require('./models');

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message) => Object.assign(new Error(message), { status });

const auth = wrap(async (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) throw fail(401, 'Please log in');
  let payload;
  try { payload = jwt.verify(h.slice(7), process.env.JWT_SECRET); } catch { throw fail(401, 'Session expired, log in again'); }
  const user = await User.findById(payload.id);
  if (!user) throw fail(401, 'Account not found');
  if (!user.accountNo) { user.accountNo = '365' + String(Math.floor(1e8 + Math.random() * 9e8)); await user.save(); }
  req.user = user; next();
});
const admin = (req, res, next) => req.user.role === 'admin' ? next() : next(fail(403, 'Admins only'));
const kycRequired = (req, res, next) => req.user.kyc.status === 'verified' ? next() : next(fail(403, 'Complete KYC first'));
const verifiedContact = (req, res, next) => req.user.emailVerified && req.user.mobileVerified ? next() : next(fail(403, 'Verify your email and mobile first'));
const sign = user => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = u => { const o = u.toObject(); delete o.password; delete o.otp; delete o.wdOtp; delete o.verifyOtp; return o; };
const ref = p => p + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

module.exports = { wrap, fail, auth, admin, kycRequired, verifiedContact, sign, publicUser, ref };
