# Invest365

A MERN-stack demo of a digital investment platform: pay from any bank, complete KYC online, invest in bonds, mutual funds and government securities, and let your salary save and invest on its own.

> **Demo project.** No real money moves. KYC, bank linking, payments and returns are simulated unless you connect real providers (see "Demo vs production"). Do not use it with real customer money without licensed partners and RBI/SEBI compliance.

---

## 1. Features

**Public site (no login)**
- Home page with sticky menu, return calculator, feature boxes (click for details), plans table, FD comparison, security section, FAQ, footer.

**Accounts and security**
- Sign up with name, mobile, email, password. An Invest365 account number is created automatically.
- Login by email + password, or by OTP (sent by email and SMS).
- Email and mobile are verified by a 6-digit code (valid 10 minutes, 5 tries, 30 seconds between sends). Both are needed before KYC. Adding money, investing and withdrawing need full verification (email, mobile and KYC).
- Passwords hashed with bcrypt, signed JWT sessions (7 days), rate limits, Helmet headers.

**KYC**
- PAN, Aadhaar (only the last 4 digits are stored), selfie, bank account. Full profile unlocks after all four are done.

**Money**
- Add money by UPI, net banking, card (demo checkout) or Razorpay (test mode).
- Link your bank once during KYC. Adding money opens after email, mobile and KYC are all verified.
- Withdraw any amount, confirmed by an OTP on email and phone. Wallet money goes first; if short, investments are exited early (preview shown before confirming).
- Salary rule: on salary credit, save X% and invest Y% automatically.
- Transactions with bank reference numbers, filter by type, CSV download.

**Investing**
- Plans: T-Bill, G-Sec, AAA Corporate Bond, Liquid Fund, Nifty 50 Index Fund, plus a demo-only "Fixed Saver".
- Risk quiz and recommendations, FD comparison, goals (car, house, retirement), SIP (monthly), portfolio mix, growth chart.
- Automatic maturity payouts, early exit.

**Admin**
- Totals (users, KYC done, invested, under management, interest paid and owed), maturity tracker, user list, held transactions, 14-day charts, a "fast-forward maturity" demo button.

**Notifications**
- Email and SMS for OTP, welcome, money added, investment, withdrawal, maturity.

---

## 2. Tech stack

| Part | Tech |
|---|---|
| Frontend | React 18, React Router, Vite, plain CSS (no UI library) |
| Backend | Node.js 18+, Express 4 |
| Database | MongoDB (Mongoose) |
| Auth | JWT, bcryptjs, OTP |
| Payments | Demo checkout, Razorpay (test mode) |
| Notifications | Nodemailer (SMTP/Gmail), Twilio or Fast2SMS |

---

## 3. Folder structure

```
invest365/
├── backend/
│   ├── server.js            App setup, routes, hourly jobs
│   ├── seed.js              Creates the admin user
│   ├── models.js            User, Investment, Transaction, Goal, Sip
│   ├── middleware.js        auth, admin, kycRequired, helpers
│   ├── routes/              auth, kyc, bank, payment, invest, admin, public
│   ├── services/
│   │   ├── plans.js         Plan catalogue (example rates)
│   │   ├── finance.js       Maturity maths, fraud rule, risk profile, FD rows
│   │   ├── invest.js        createInvestment
│   │   ├── maturity.js      Pays out matured plans
│   │   ├── sip.js           Runs monthly SIPs
│   │   └── notify.js        Email + SMS
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── vite.config.js       Proxies /api to the backend
│   └── src/ (App.jsx, api.js, styles.css, main.jsx)
└── README.md
```

---

## 4. Setup

**Needs:** Node 18 or newer, MongoDB (local, or a free MongoDB Atlas cluster).

**Backend** (terminal 1)
```
cd backend
copy .env.example .env        (Mac/Linux: cp .env.example .env)
npm install
npm run seed                  (creates the admin user, once)
npm run dev
```
You should see `API running on port 5000`.

**Frontend** (terminal 2)
```
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

**Admin login:** `admin@invest365.com` / `Admin@12345`. Change this password before showing it to anyone.

---

## 5. Environment variables (`backend/.env`)

| Name | Required | Meaning |
|---|---|---|
| `PORT` | no | API port, default 5000 |
| `MONGO_URI` | yes | e.g. `mongodb://127.0.0.1:27017/invest365` |
| `JWT_SECRET` | yes | Long random text. Never share or commit it |
| `CLIENT_URL` | no | Frontend URL for CORS, default `http://localhost:5173` |
| `NODE_ENV` | no | Set `production` to stop OTPs showing on screen |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | no | Razorpay **test** keys. Adds a Razorpay tab |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | no | Email. For Gmail use an App Password |
| `SMS_PROVIDER` | no | `twilio`, `fast2sms`, or empty to skip SMS |
| `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM` | if twilio | Twilio details |
| `FAST2SMS_KEY` | if fast2sms | Fast2SMS API key |

Never commit `.env`. It is already in `.gitignore`.

### Gmail App Password
Google Account > Security > turn on 2-Step Verification > App passwords > create one > put the 16 letters in `SMTP_PASS`.

### Razorpay test mode
dashboard.razorpay.com > switch to Test mode > Settings > API Keys > generate. Paste both keys, restart the backend. Payments are verified by signature on the server, and the amount is read from Razorpay, never from the browser.

### SMS
- **Twilio:** trial accounts only text verified numbers. Fine for demos.
- **Fast2SMS:** needs wallet balance. Check their current API docs against `services/notify.js`.
- Live SMS in India needs DLT registration.

With no email or SMS configured, messages print in the backend terminal, and the OTP is shown on screen (unless `NODE_ENV=production`).

---

## 6. Try it (demo flow)

1. Sign up on the home page, then verify your email and mobile on the Verify page (the code is filled in for you when email/SMS is not configured).
2. **KYC:** PAN like `ABCDE1234F`, any 12-digit Aadhaar starting 2 to 9, OTP `123456`, take a selfie, and link a bank on the Bank page (account number 9 to 18 digits, IFSC like `SBIN0001234`).
3. **Add money** (opens after full verification): UPI `demo@okhdfc`, or card `4111 1111 1111 1111` (any future expiry, CVV `123`), or net banking.
4. **Invest:** take the risk quiz, pick a plan. Try a SIP and click "Run now".
5. **Salary rule:** Bank page, set save and invest %, turn on, click "Credit salary".
6. **Withdraw:** enter more than your wallet to see the early-exit preview.
7. **Admin:** log in as admin, click "fast-forward maturity", then see payouts in the user's wallet.

---

## 7. Business rules

- Payments: minimum Rs 100, no upper limit.
- Fraud rule: 8 or more transactions in 10 minutes are held (shown to admin). There is no amount-based hold.
- Plan minimums: Rs 500 to Rs 5,000 (see the plans table).
- Maturity value: `amount x (1 + rate/100) ^ (months/12)`.
- Early exit: principal + half of the interest earned so far.
- Salary rule: save % + invest % must not exceed 90%. The invest part goes to the first suggested plan for your risk profile, if it meets the minimum.
- SIP: day 1 to 28 of each month, paid from the wallet, skipped and retried hourly if the wallet is short.
- Withdrawals need an OTP sent by email and SMS: valid 5 minutes, 5 wrong tries, tied to one amount, single use, 30 seconds between sends. The code is stored only as a hash.
- Login OTP is valid for 5 minutes. Rate limits: 200 requests/minute on the API, 20/minute on auth.
- Background jobs run on start and then every hour: maturity payouts and SIPs.

---

## 8. API reference

All routes start with `/api`. Send `Authorization: Bearer <token>` unless marked public.

| Area | Endpoints |
|---|---|
| Public | `GET /public/plans`, `GET /public/fd-compare?amount=&months=` |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/otp/send`, `/auth/otp/verify`, `/auth/verify/send`, `/auth/verify/confirm` (body: `channel` = `email` or `mobile`), `GET /auth/me` |
| KYC | `POST /kyc/pan`, `/kyc/aadhaar`, `/kyc/face` |
| Payments | `GET /pay/config`, `POST /pay/checkout`, `/pay/razorpay/order`, `/pay/razorpay/verify` |
| Bank | `POST /bank/link`, `GET /bank/balance`, `GET /bank/withdraw-preview?amount=`, `POST /bank/withdraw/request` (sends OTP), `POST /bank/withdraw` (needs `otp`), `PUT /bank/sweep`, `POST /bank/salary`, `GET /bank/transactions?type=` |
| Invest | `GET /invest/plans`, `POST /invest/risk`, `GET /invest/recommend`, `POST /invest`, `GET /invest`, `GET /invest/portfolio`, `GET /invest/growth`, `POST /invest/:id/redeem` |
| Goals | `GET/POST /invest/goals`, `DELETE /invest/goals/:id` |
| SIP | `GET/POST /invest/sips`, `POST /invest/sips/:id/toggle`, `POST /invest/sips/:id/run`, `DELETE /invest/sips/:id` |
| Admin | `GET /admin/stats`, `/admin/users`, `/admin/maturities`, `/admin/flagged`, `/admin/series`, `POST /admin/fast-forward` |

Investing, withdrawing and SIP creation need KYC to be verified. Admin routes need the admin role.

---

## 9. Database (MongoDB)

- **User:** name, mobile, email, password (hash), role, accountNo, kyc{pan (masked), aadhaarLast4, panOk, aadhaarOk, faceOk, bankOk, status}, bank{bankName, accountLast4, ifsc, balance}, wallet, risk{score, profile}, sweep{enabled, savePct, investPct}
- **Investment:** user, planKey, planName, category, amount, returnPct, tenureMonths, startDate, maturityDate, goal, status (active / matured / redeemed), payout
- **Transaction:** user, type (deposit, withdrawal, investment, interest, redemption, salary, saving), amount, ref, note, status (success / flagged)
- **Goal:** user, name, icon, target, targetDate
- **Sip:** user, planKey, planName, amount, dayOfMonth, active, lastRun, lastStatus

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| "Request failed" on sign up | Backend is not running. Start it and check the terminal |
| `ECONNREFUSED` in the Vite terminal | Same: nothing is listening on port 5000 |
| `EADDRINUSE :::5000` | An old backend is still running. `netstat -ano \| findstr :5000`, then `taskkill /PID <pid> /F`, or change `PORT` and the proxy in `vite.config.js` |
| `MongoDB connection failed` | Start MongoDB, or use an Atlas URI in `MONGO_URI` |
| `Copy .env.example to .env` | Create `backend/.env` and set `JWT_SECRET` |
| `Cannot find module 'nodemailer'` | Run `npm install` in `backend` |
| No email arrives | Check spam, the App Password, and the backend terminal for `[notify] failed` |
| New features not showing | Old servers still running. Stop all terminals, restart both, hard refresh with `Ctrl + Shift + R` |

---

## 11. Demo vs production

| Part | In this project | For a real launch |
|---|---|---|
| KYC | Format checks, demo OTP `123456` | Licensed provider (Digio, Signzy, IDfy), DigiLocker |
| Bank link and balance | Simulated | Account Aggregator, penny-drop verification |
| Payments | Demo checkout, Razorpay test | Live gateway with webhooks and business KYC |
| Mutual funds | Simulated returns | BSE StAR MF / NSE NMF via a SEBI-registered distributor |
| Fixed returns | "Fixed Saver" is demo only | Only through a licensed bank or NBFC |
| Fraud check | Simple rules | Risk engine, device and behaviour signals |
| SIP | Wallet debit | UPI AutoPay or e-mandate |
| Secrets and hosting | Local | HTTPS, secret manager, backups, audit logs |

Handling customer money, promising returns and offering investments are regulated in India. Get proper approvals before going live.

---

## 12. Ideas to add next

Forgot password, 2FA or app PIN, nominee details, KYC review queue for admin, audit log, PDF statements, tax and capital-gains report, referral code, Hindi/English toggle, PWA install, chatbot, tests (Jest + Supertest), Docker setup.
