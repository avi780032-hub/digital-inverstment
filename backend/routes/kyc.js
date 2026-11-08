const router = require('express').Router();
const { wrap, fail, auth, verifiedContact, publicUser } = require('../middleware');

// DEMO verifiers. Replace each block with a licensed KYC provider (Digio, Signzy, IDfy, Karza, DigiLocker).
async function finish(user, res) {
  const k = user.kyc;
  k.status = k.panOk && k.aadhaarOk && k.faceOk && k.bankOk ? 'verified' : 'pending';
  await user.save(); res.json({ user: publicUser(user) });
}

router.post('/pan', auth, verifiedContact, wrap(async (req, res) => {
  const pan = (req.body.pan || '').toUpperCase();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) throw fail(400, 'PAN must look like ABCDE1234F');
  req.user.kyc.pan = pan.slice(0, 2) + '****' + pan.slice(6); req.user.kyc.panOk = true;
  await finish(req.user, res);
}));

router.post('/aadhaar', auth, verifiedContact, wrap(async (req, res) => {
  const a = (req.body.aadhaar || '').replace(/\s/g, '');
  if (!/^[2-9]\d{11}$/.test(a)) throw fail(400, 'Aadhaar must be 12 digits');
  if (req.body.otp !== '123456') throw fail(400, 'Wrong OTP (demo OTP is 123456)');
  req.user.kyc.aadhaarLast4 = a.slice(-4); req.user.kyc.aadhaarOk = true; // full number is never stored
  await finish(req.user, res);
}));

router.post('/face', auth, verifiedContact, wrap(async (req, res) => {
  if (!req.body.image || req.body.image.length < 100) throw fail(400, 'Capture a selfie first');
  req.user.kyc.faceOk = true; // real flow: liveness check + face match with Aadhaar photo
  await finish(req.user, res);
}));

module.exports = router;
module.exports.finish = finish;
