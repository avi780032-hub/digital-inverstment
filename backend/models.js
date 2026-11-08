const mongoose = require('mongoose');
const { Schema } = mongoose;
const ObjId = Schema.Types.ObjectId;

const User = mongoose.model('User', new Schema({
  name: String,
  mobile: { type: String, unique: true },
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'user' },
  accountNo: String, // Invest365 account number, opened automatically at sign-up
  // Never store full Aadhaar: only last 4 digits (UIDAI rules)
  kyc: {
    pan: String, panOk: { type: Boolean, default: false },
    aadhaarLast4: String, aadhaarOk: { type: Boolean, default: false },
    faceOk: { type: Boolean, default: false },
    bankOk: { type: Boolean, default: false },
    status: { type: String, default: 'pending' }
  },
  bank: { bankName: String, accountLast4: String, ifsc: String, balance: { type: Number, default: 0 } },
  wallet: { type: Number, default: 0 },
  risk: { score: Number, profile: String },
  sweep: { enabled: { type: Boolean, default: false }, savePct: { type: Number, default: 10 }, investPct: { type: Number, default: 20 } },
  otp: { code: String, expires: Date },
  emailVerified: { type: Boolean, default: false }, mobileVerified: { type: Boolean, default: false },
  verifyOtp: { email: { hash: String, expires: Date, tries: { type: Number, default: 0 }, sentAt: Date }, mobile: { hash: String, expires: Date, tries: { type: Number, default: 0 }, sentAt: Date } },
  // Withdrawal OTP: stored as a hash, tied to one amount, single use
  wdOtp: { hash: String, expires: Date, amount: Number, tries: { type: Number, default: 0 }, sentAt: Date }
}, { timestamps: true }));

const Investment = mongoose.model('Investment', new Schema({
  user: { type: ObjId, ref: 'User', index: true },
  planKey: String, planName: String, category: String,
  amount: Number, returnPct: Number, tenureMonths: Number,
  startDate: Date, maturityDate: Date,
  goal: { type: ObjId, ref: 'Goal' },
  status: { type: String, default: 'active' }, // active | matured | redeemed
  payout: Number
}, { timestamps: true }));

const Transaction = mongoose.model('Transaction', new Schema({
  user: { type: ObjId, ref: 'User', index: true },
  type: String, // deposit | withdrawal | investment | interest | redemption | salary | saving
  amount: Number,
  ref: String,
  note: String,
  status: { type: String, default: 'success' } // success | flagged
}, { timestamps: true }));

const Goal = mongoose.model('Goal', new Schema({
  user: { type: ObjId, ref: 'User', index: true },
  name: String, icon: String, target: Number, targetDate: Date
}, { timestamps: true }));

const Sip = mongoose.model('Sip', new Schema({
  user: { type: ObjId, ref: 'User', index: true },
  planKey: String, planName: String, amount: Number,
  dayOfMonth: Number, active: { type: Boolean, default: true },
  lastRun: Date, lastStatus: String
}, { timestamps: true }));

module.exports = { User, Investment, Transaction, Goal, Sip };
