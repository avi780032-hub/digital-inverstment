import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Routes, Route, NavLink, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { api, inr, day } from './api.js';

const useLoad = (path, deps = []) => {
  const [data, setData] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(() => api(path).then(setData).catch(e => setErr(e.message)), [path]);
  useEffect(() => { load(); }, [load, ...deps]);
  return [data, load, err];
};
const Msg = ({ m }) => m ? <div className={'msg ' + (m.ok ? 'good' : 'err')}>{m.t}</div> : null;
const useAct = () => {
  const [m, setM] = useState(null);
  const run = async (fn, okText) => { setM(null); try { const r = await fn(); setM({ ok: true, t: okText || 'Done' }); return r; } catch (e) { setM({ t: e.message }); } };
  return [m, run];
};

function Auth({ onAuth }) {
  const [tab, setTab] = useState((useLocation().state || {}).tab || 'login'); const [f, setF] = useState({}); const [otpSent, setOtpSent] = useState(false); const [m, run] = useAct();
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const done = r => { if (r) { localStorage.setItem('token', r.token); onAuth(r.user); } };
  return (
    <div className="auth"><div className="card big">
      <div className="brand">Invest<b>365</b></div>
      <p className="muted">Save and invest automatically every time your salary arrives. <Link to="/">Back to home</Link></p>
      <div className="tabs">{[['login', 'Log in'], ['otp', 'OTP'], ['register', 'Sign up']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setOtpSent(false); }}>{l}</button>)}</div>
      {tab === 'register' && <><label>Full name</label><input value={f.name || ''} onChange={set('name')} /><label>Mobile</label><input value={f.mobile || ''} onChange={set('mobile')} inputMode="numeric" maxLength={10} /></>}
      {tab === 'otp' && <><label>Mobile</label><input value={f.mobile || ''} onChange={set('mobile')} inputMode="numeric" maxLength={10} />{otpSent && <><label>OTP</label><input value={f.otp || ''} onChange={set('otp')} inputMode="numeric" maxLength={6} /></>}</>}
      {tab !== 'otp' && <><label>Email</label><input type="email" value={f.email || ''} onChange={set('email')} /><label>Password</label><input type="password" value={f.password || ''} onChange={set('password')} /></>}
      <Msg m={m} />
      <div className="gap">
        {tab === 'login' && <button onClick={async () => done(await run(() => api('/auth/login', 'POST', f)))}>Log in</button>}
        {tab === 'register' && <button onClick={async () => done(await run(() => api('/auth/register', 'POST', f)))}>Create account</button>}
        {tab === 'otp' && !otpSent && <button onClick={async () => { const r = await run(() => api('/auth/otp/send', 'POST', { mobile: f.mobile }), 'OTP sent'); if (r) { setOtpSent(true); if (r.devOtp) setF({ ...f, otp: r.devOtp }); } }}>Send OTP</button>}
        {tab === 'otp' && otpSent && <button onClick={async () => done(await run(() => api('/auth/otp/verify', 'POST', { mobile: f.mobile, otp: f.otp })))}>Verify and log in</button>}
      </div>
    </div></div>
  );
}

const short = v => v >= 1e7 ? (v / 1e7).toFixed(1) + 'Cr' : v >= 1e5 ? (v / 1e5).toFixed(1) + 'L' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : Math.round(v);
function LineChart({ points }) {
  const W = 600, H = 230, L = 40, R = 12, B = 26, T = 10;
  const top = Math.max(1, ...points.map(p => Math.max(p.value, p.invested)));
  const x = i => L + (points.length === 1 ? 0 : i * (W - L - R) / (points.length - 1)), y = v => H - B - (v / (top * 1.08)) * (H - B - T);
  const path = k => points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[k]).toFixed(1)).join(' ');
  const lab = i => new Date(points[i].t).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  const ticks = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const fi = points.findIndex(p => p.future);
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }} role="img" aria-label="Amount invested and portfolio value over time">
    {[0, .5, 1].map(f => <g key={f}><line x1={L} x2={W - R} y1={y(top * f)} y2={y(top * f)} stroke="rgba(255,255,255,.12)" /><text x={2} y={y(top * f) + 4} fill="#9fbab5" fontSize="10">{short(top * f)}</text></g>)}
    {fi > 0 && <g><line x1={x(fi - 1)} x2={x(fi - 1)} y1={T} y2={H - B} stroke="rgba(255,255,255,.35)" strokeDasharray="4 4" /><text x={x(fi - 1) + 4} y={T + 10} fill="#9fbab5" fontSize="10">today</text></g>}
    <path d={path('invested')} fill="none" stroke="#5eead4" strokeWidth="2.5" /><path d={path('value')} fill="none" stroke="#ffb627" strokeWidth="2.5" />
    {ticks.map(i => <text key={i} x={x(i)} y={H - 8} fill="#9fbab5" fontSize="10" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>{lab(i)}</text>)}
  </svg>;
}
function BarChart({ data, money }) {
  const W = 600, H = 190, B = 24, T = 14, max = Math.max(1, ...data.map(d => d.value)), bw = (W - 20) / data.length;
  return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }} role="img" aria-label="Daily totals for the last 14 days">
    {data.map((d, i) => { const h = d.value / max * (H - B - T); return <g key={d.label}>
      <rect x={10 + i * bw + 4} y={H - B - h} width={bw - 8} height={Math.max(h, 1)} rx="4" fill="#5eead4" opacity={d.value ? 1 : .25} />
      {d.value > 0 && <text x={10 + i * bw + bw / 2} y={H - B - h - 4} fill="#eef6f3" fontSize="9" textAnchor="middle">{money ? short(d.value) : d.value}</text>}
      {i % 2 === 0 && <text x={10 + i * bw + bw / 2} y={H - 8} fill="#9fbab5" fontSize="9" textAnchor="middle">{d.label}</text>}</g>; })}
  </svg>;
}
const loadRzp = () => new Promise((ok, bad) => { if (window.Razorpay) return ok(); const sc = document.createElement('script'); sc.src = 'https://checkout.razorpay.com/v1/checkout.js'; sc.onload = ok; sc.onerror = () => bad(new Error('Could not load Razorpay. Check your internet.')); document.body.appendChild(sc); });
async function payRazorpay(amount, user) {
  await loadRzp(); const o = await api('/pay/razorpay/order', 'POST', { amount });
  return new Promise((resolve, reject) => new window.Razorpay({ key: o.keyId, order_id: o.orderId, amount: o.amount, currency: 'INR', name: 'Invest365', description: 'Add money',
    prefill: { name: user.name, email: user.email, contact: user.mobile }, theme: { color: '#ffb627' },
    handler: r => api('/pay/razorpay/verify', 'POST', { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }).then(resolve, reject),
    modal: { ondismiss: () => reject(new Error('Payment cancelled')) } }).open());
}
function downloadCsv(rows) {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = ['Date,Type,Amount,Reference,Note,Status', ...rows.map(r => [new Date(r.createdAt).toISOString().slice(0, 10), r.type, r.amount, r.ref, r.note, r.status].map(q).join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'invest365-statement.csv'; a.click(); URL.revokeObjectURL(a.href);
}

function Sips({ plans, reload, setUser }) {
  const [list, load] = useLoad('/invest/sips'); const [f, setF] = useState({ planKey: 'liquid-mf', amount: '1000', dayOfMonth: '5' }); const [m, run] = useAct();
  const set = k => e => setF({ ...f, [k]: e.target.value });
  return <div className="card gap"><h2>SIP: invest every month</h2>
    <p className="muted">A fixed amount moves from your wallet into a plan on the day you pick. Keep enough in the wallet. If it is short, that month is skipped and retried later.</p>
    <div className="row"><div><label>Plan</label><select value={f.planKey} onChange={set('planKey')}>{(plans || []).map(p => <option key={p.key} value={p.key}>{p.name}</option>)}</select></div>
      <div><label>Amount</label><input type="number" value={f.amount} onChange={set('amount')} /></div>
      <div><label>Day of month (1 to 28)</label><input type="number" min="1" max="28" value={f.dayOfMonth} onChange={set('dayOfMonth')} /></div></div>
    <div className="gap"><button onClick={async () => { await run(() => api('/invest/sips', 'POST', f), 'SIP started'); load(); }}>Start SIP</button></div>
    <Msg m={m} />
    {list && list.sips.length > 0 && <div className="tablewrap gap"><table><thead><tr><th>Plan</th><th>Amount</th><th>Day</th><th>Last result</th><th></th></tr></thead><tbody>
      {list.sips.map(x => <tr key={x._id}><td>{x.planName}</td><td>{inr(x.amount)}</td><td>{x.dayOfMonth}</td><td>{x.active ? (x.lastStatus || 'Waiting for its day') : 'Paused'}</td>
        <td><div className="row">
          <button className="ghost" onClick={async () => { await run(async () => { const r = await api(`/invest/sips/${x._id}/run`, 'POST'); setUser(r.user); }, 'Instalment run'); load(); reload(); }}>Run now</button>
          <button className="ghost" onClick={async () => { await api(`/invest/sips/${x._id}/toggle`, 'POST'); load(); }}>{x.active ? 'Pause' : 'Resume'}</button>
          <button className="ghost" onClick={async () => { await api(`/invest/sips/${x._id}`, 'DELETE'); load(); }}>Stop</button></div></td></tr>)}
    </tbody></table></div>}
  </div>;
}

const Stat = ({ label, value, gold }) => <div className={'card stat' + (gold ? ' gold' : '')}><small>{label}</small><strong>{value}</strong></div>;

function VerifyCard({ channel, label, value, done, setUser }) {
  const [otp, setOtp] = useState(''); const [sent, setSent] = useState(null); const [wait, setWait] = useState(0); const [m, run] = useAct();
  useEffect(() => { if (wait > 0) { const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); } }, [wait]);
  const send = () => run(async () => { const r = await api('/auth/verify/send', 'POST', { channel }); setSent(r); setOtp(r.devOtp || ''); setWait(30); }, 'Code sent');
  const confirm = () => run(async () => { const r = await api('/auth/verify/confirm', 'POST', { channel, otp }); setUser(r.user); }, label + ' verified');
  return <div className={'card' + (done ? ' done' : '')}><div className="row space"><h3>{label}</h3><span className={'pill ' + (done ? 'ok' : 'warn')}>{done ? 'Verified' : 'Pending'}</span></div>
    <p className="muted">{value}</p>
    {!done && <>
      {sent && <p className="muted">{sent.sentTo ? 'Code sent to ' + sent.sentTo + '.' : 'This channel is not set up on the server, so the code is filled in for testing.'}</p>}
      <div className="row"><button className="ghost" disabled={wait > 0} onClick={send}>{wait > 0 ? `Resend in ${wait}s` : sent ? 'Resend code' : 'Send code'}</button>
        {sent && <><input style={{ maxWidth: 150 }} inputMode="numeric" maxLength={6} placeholder="6-digit code" value={otp} onChange={e => setOtp(e.target.value)} /><button disabled={otp.length !== 6} onClick={confirm}>Verify</button></>}</div>
    </>}
    <Msg m={m} />
  </div>;
}
function Verify({ user, setUser }) {
  const both = user.emailVerified && user.mobileVerified; const nav = useNavigate(); const was = useRef(both);
  useEffect(() => { // when the second check passes, take the user to Add money
    if (both && !was.current) { const t = setTimeout(() => nav('/bank'), 1500); was.current = true; return () => clearTimeout(t); }
    was.current = both;
  }, [both, nav]);
  return <><h1>Verify your contact details</h1>
    <p className="muted">Confirm your email and mobile once. This keeps your account safe, and your OTPs go to the right place. You need both before KYC, adding money and withdrawing.</p>
    <div className="grid"><VerifyCard channel="email" label="Email" value={user.email} done={user.emailVerified} setUser={setUser} /><VerifyCard channel="mobile" label="Mobile" value={'+91 ' + user.mobile} done={user.mobileVerified} setUser={setUser} /></div>
    {both && <div className="msg good gap">Both verified. Taking you to Add money... <NavLink to="/bank">Add money now</NavLink> or <NavLink to="/kyc">start KYC</NavLink></div>}
  </>;
}

function Dashboard({ user }) {
  const [p] = useLoad('/invest/portfolio'); const [g] = useLoad('/invest/goals'); const [gr] = useLoad('/invest/growth'); const [tx] = useLoad('/bank/transactions');
  const kycDone = user.kyc.status === 'verified';
  return <>
    <h1>Hi {user.name.split(' ')[0]}</h1>
    <div className="quickrow">{[['/bank', 'Add money', 'UPI, bank, card'], ['/invest', 'Invest', 'Pick a plan'], ['/invest', 'Start SIP', 'Every month'], ['/bank', 'Withdraw', 'To your bank'], ['/goals', 'Goals', 'Track progress']].map(([to, t, d]) => <NavLink className="quick" key={t} to={to}>{t}<small>{d}</small></NavLink>)}</div>
    {user.role !== 'admin' && !(user.emailVerified && user.mobileVerified) && <div className="msg err">Verify your email and mobile to start KYC and add money. <NavLink to="/verify">Verify now</NavLink></div>}
    {!kycDone && <div className="msg err">Finish KYC (PAN, Aadhaar, selfie, bank) to start investing. <NavLink to="/kyc">Go to KYC</NavLink></div>}
    <div className="grid">
      <Stat label="Bank balance" value={inr(user.bank.balance)} />
      <Stat label="Wallet" value={inr(user.wallet)} />
      <Stat label="Invested" value={inr(p && p.invested)} />
      <Stat label="Current value" value={inr(p && p.value)} gold />
    </div>
    {gr && gr.points.length > 1 && <div className="card gap"><h2>Growth</h2>
      <div className="row muted"><span style={{ color: 'var(--mint)' }}>■ Invested</span><span style={{ color: 'var(--gold)' }}>■ Value (estimate, to maturity)</span></div>
      <LineChart points={gr.points} /></div>}
    <div className="grid gap">
      <div className="card"><h2>Portfolio mix</h2>
        {p && Object.keys(p.byCategory).length ? Object.entries(p.byCategory).map(([k, v]) => <div key={k} style={{ marginBottom: '.7rem' }}><div className="row" style={{ justifyContent: 'space-between' }}><span>{k}</span><span>{inr(v)}</span></div><div className="bar"><i style={{ width: (v / p.invested * 100) + '%' }} /></div></div>) : <p className="muted">Nothing invested yet.</p>}
      </div>
      <div className="card"><h2>Goals</h2>
        {g && g.goals.length ? g.goals.slice(0, 4).map(x => <div key={x._id} style={{ marginBottom: '.7rem' }}><div className="row" style={{ justifyContent: 'space-between' }}><span>{x.icon} {x.name}</span><span>{inr(x.saved)} / {inr(x.target)}</span></div><div className="bar"><i style={{ width: Math.min(100, x.saved / x.target * 100) + '%' }} /></div></div>) : <p className="muted">Add a goal like a car, house or retirement.</p>}
      </div>
    </div>
    <div className="card gap"><div className="row space"><h2>Recent activity</h2><NavLink to="/transactions">See all</NavLink></div>
      {tx && tx.transactions.length ? <div className="tablewrap"><table><tbody>{tx.transactions.slice(0, 5).map(x => <tr key={x._id}><td>{day(x.createdAt)}</td><td>{x.type}</td><td>{x.note}</td><td style={{ textAlign: 'right' }}>{inr(x.amount)}</td></tr>)}</tbody></table></div> : <p className="muted">No activity yet. Add money to get started.</p>}</div>
    <p className="muted gap">Risk profile: {user.risk && user.risk.profile ? user.risk.profile : 'not set. Take the quiz on the Invest page.'}</p>
  </>;
}

const Step = ({ ok, title, children }) => <div className={'card' + (ok ? ' done' : '')}><div className="row" style={{ justifyContent: 'space-between' }}><h3>{title}</h3><span className={'pill ' + (ok ? 'ok' : 'warn')}>{ok ? 'Verified' : 'Pending'}</span></div>{children}</div>;

function Kyc({ user, setUser }) {
  const [f, setF] = useState({}); const [m, run] = useAct(); const [cam, setCam] = useState(null);
  const k = user.kyc; const set = key => e => setF({ ...f, [key]: e.target.value });
  const go = (path, body, ok) => run(async () => { const r = await api(path, 'POST', body); setUser(r.user); }, ok);
  const snap = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true }); const v = document.createElement('video'); v.srcObject = s; await v.play();
      const c = document.createElement('canvas'); c.width = 320; c.height = 240; c.getContext('2d').drawImage(v, 0, 0, 320, 240); s.getTracks().forEach(t => t.stop());
      setCam(c.toDataURL('image/jpeg'));
    } catch { setCam('data:image/jpeg;base64,' + 'A'.repeat(200)); } // demo fallback if camera is blocked
  };
  return <>
    <h1>KYC</h1><p className="muted">Status: <span className={'pill ' + (k.status === 'verified' ? 'ok' : 'warn')}>{k.status}</span>. Demo mode: Aadhaar OTP is 123456. Real checks need a licensed KYC provider.</p>
    <Msg m={m} />
    <div className="steps">
      <Step ok={k.panOk} title="PAN">{k.panOk ? <p className="muted">{k.pan}</p> : <><input placeholder="ABCDE1234F" value={f.pan || ''} onChange={set('pan')} maxLength={10} /><div className="gap"><button onClick={() => go('/kyc/pan', { pan: f.pan }, 'PAN verified')}>Verify PAN</button></div></>}</Step>
      <Step ok={k.aadhaarOk} title="Aadhaar">{k.aadhaarOk ? <p className="muted">XXXX XXXX {k.aadhaarLast4}</p> : <><input placeholder="12-digit Aadhaar" value={f.aadhaar || ''} onChange={set('aadhaar')} maxLength={12} /><input style={{ marginTop: '.5rem' }} placeholder="OTP" value={f.otp || ''} onChange={set('otp')} maxLength={6} /><div className="gap"><button onClick={() => go('/kyc/aadhaar', { aadhaar: f.aadhaar, otp: f.otp }, 'Aadhaar verified')}>Verify Aadhaar</button></div></>}</Step>
      <Step ok={k.faceOk} title="Face check">{k.faceOk ? <p className="muted">Selfie matched</p> : <><div className="row"><button className="ghost" onClick={snap}>Take selfie</button>{cam && <img alt="selfie" src={cam} width="80" style={{ borderRadius: 10 }} />}</div><div className="gap"><button disabled={!cam} onClick={() => go('/kyc/face', { image: cam }, 'Face verified')}>Verify face</button></div></>}</Step>
      <Step ok={k.bankOk} title="Bank account">{k.bankOk ? <p className="muted">{user.bank.bankName} ****{user.bank.accountLast4}</p> : <p className="muted">Link your account on the <NavLink to="/bank">Bank page</NavLink>.</p>}</Step>
    </div>
  </>;
}

const methods = [['upi', 'UPI'], ['netbanking', 'Net banking'], ['card', 'Card']];
function Checkout({ user, setUser }) {
  const [amount, setAmount] = useState('5000'); const [method, setMethod] = useState('upi'); const [f, setF] = useState({});
  const [stage, setStage] = useState('form'); const [err, setErr] = useState(''); const [rc, setRc] = useState(null); const [cfg, setCfg] = useState(null);
  useEffect(() => { api('/pay/config').then(setCfg).catch(() => {}); }, []);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const pay = async () => {
    setErr(''); setStage('processing');
    try {
      const body = { amount: Number(amount), method, ...(method === 'upi' && { upiId: f.upi }), ...(method === 'netbanking' && { bankName: f.bankName, accountNumber: f.accountNumber, ifsc: f.ifsc }), ...(method === 'card' && { card: { number: f.card, expiry: f.expiry, cvv: f.cvv } }) };
      const [r] = await Promise.all([method === 'razorpay' ? payRazorpay(Number(amount), user) : api('/pay/checkout', 'POST', body), new Promise(ok => setTimeout(ok, 1400))]);
      setUser(r.user); setRc(r.receipt); setStage('done');
    } catch (e) { setErr(e.message); setStage('form'); }
  };
  if (stage === 'done') return <div className="card big pay"><div className="tick">✓</div><h2>Payment successful</h2><strong className="amt">{inr(rc.amount)}</strong>
    <div className="kv row space"><span className="muted">Paid via</span><span>{rc.via}</span></div><div className="kv row space"><span className="muted">Bank reference (UTR)</span><span>{rc.ref}</span></div>
    <div className="kv row space"><span className="muted">Time</span><span>{new Date(rc.at).toLocaleString('en-IN')}</span></div><div className="kv row space"><span className="muted">Wallet balance</span><strong>{inr(user.wallet)}</strong></div>
    <button className="payBtn" onClick={() => { setStage('form'); setRc(null); }}>Add more money</button></div>;
  return <div className="card big pay">
    <div className="row space"><h2>Add money</h2><span className="pill ok">Secure checkout</span></div>
    <label>Amount</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
    <div className="chips">{[1000, 5000, 10000, 25000].map(v => <button key={v} onClick={() => setAmount(String(v))}>{inr(v)}</button>)}</div>
    <div className="tabs">{(cfg && cfg.razorpay ? [['razorpay', 'Razorpay'], ...methods] : methods).map(([k, l]) => <button key={k} className={method === k ? 'on' : ''} onClick={() => setMethod(k)}>{l}</button>)}</div>
    {method === 'upi' && <><label>UPI ID</label><input placeholder="name@okhdfc" value={f.upi || ''} onChange={set('upi')} /></>}
    {method === 'netbanking' && <><label>Bank name</label><input value={f.bankName || ''} onChange={set('bankName')} /><label>Account number</label><input inputMode="numeric" value={f.accountNumber || ''} onChange={set('accountNumber')} /><label>IFSC</label><input maxLength={11} value={f.ifsc || ''} onChange={set('ifsc')} /><p className="muted">Pay from your own bank account. No separate account to open.</p></>}
    {method === 'card' && <><label>Card number</label><input inputMode="numeric" maxLength={19} value={f.card || ''} onChange={set('card')} /><div className="row"><div style={{ flex: 1 }}><label>Expiry</label><input placeholder="MM/YY" maxLength={5} value={f.expiry || ''} onChange={set('expiry')} /></div><div style={{ flex: 1 }}><label>CVV</label><input type="password" inputMode="numeric" maxLength={3} value={f.cvv || ''} onChange={set('cvv')} /></div></div></>}
    {method === 'razorpay' && <p className="muted">You will pay in Razorpay’s secure window (test mode). Use their test card or UPI.</p>}
    {err && <div className="msg err">{err}</div>}
    <button className="payBtn" disabled={stage === 'processing'} onClick={pay}>{stage === 'processing' ? 'Processing payment...' : 'Pay ' + inr(amount)}</button>
    <p className="muted">Demo checkout, no real money moves. Try UPI demo@okhdfc or card 4111 1111 1111 1111, any future expiry, CVV 123.</p>
  </div>;
}

function Withdraw({ user, setUser }) {
  const [a, setA] = useState(''); const [pv, setPv] = useState(null); const [m, run] = useAct();
  const [step, setStep] = useState('form'); const [otp, setOtp] = useState(''); const [info, setInfo] = useState(null); const [wait, setWait] = useState(0);
  useEffect(() => {
    if (step !== 'form' || !(Number(a) > 0)) { if (step === 'form') setPv(null); return; }
    const t = setTimeout(() => api('/bank/withdraw-preview?amount=' + a).then(setPv).catch(e => setPv({ error: e.message })), 300);
    return () => clearTimeout(t);
  }, [a, user.wallet, step]);
  useEffect(() => { if (wait > 0) { const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); } }, [wait]);
  const send = () => run(async () => { const r = await api('/bank/withdraw/request', 'POST', { amount: a }); setInfo(r); setOtp(r.devOtp || ''); setStep('otp'); setWait(30); }, 'OTP sent');
  const confirm = () => run(async () => { const r = await api('/bank/withdraw', 'POST', { amount: a, otp, useInvestments: true }); setUser(r.user); setA(''); setOtp(''); setInfo(null); setStep('form'); }, 'Withdrawal confirmed. Your money is on its way to your bank.');
  return <div className="card gap"><h2>Withdraw</h2>
    <p className="muted">Take out only what you need. Wallet money goes first. If it falls short, we exit investments for the rest. Every withdrawal is confirmed with an OTP.</p>
    {step === 'form' && <>
      <div className="row"><input style={{ maxWidth: 220 }} type="number" placeholder="Amount" value={a} onChange={e => setA(e.target.value)} /><button disabled={!pv || pv.error || !pv.possible} onClick={send}>Send OTP {a ? 'to withdraw ' + inr(a) : ''}</button></div>
      {pv && pv.error && <div className="msg err">{pv.error}</div>}
      {pv && !pv.error && <div className="muted gap">
        <div>From wallet: {inr(Math.min(Number(a), pv.wallet))}</div>
        {pv.redeem.map(r => <div key={r.planName + r.amount}>Exit {r.planName} ({inr(r.amount)} invested): you get {inr(r.payout)} after early-exit terms</div>)}
        {!pv.possible && <div style={{ color: 'var(--bad)' }}>Wallet and investments together are not enough for this amount.</div>}
        {pv.redeem.length > 0 && pv.possible && <div>Early exit pays the principal plus half of the interest earned so far. Any extra stays in your wallet.</div>}
      </div>}
    </>}
    {step === 'otp' && <>
      <p className="muted">Withdrawing <strong>{inr(a)}</strong>. {info && (info.sentTo.email || info.sentTo.sms) ? 'We sent a 6-digit code to ' + [info.sentTo.email, info.sentTo.sms].filter(Boolean).join(' and ') + '.' : 'Email and SMS are not set up on the server, so the code is filled in for testing.'}</p>
      <div className="row"><input style={{ maxWidth: 200 }} inputMode="numeric" maxLength={6} placeholder="6-digit OTP" value={otp} onChange={e => setOtp(e.target.value)} /><button disabled={otp.length !== 6} onClick={confirm}>Confirm withdrawal</button></div>
      <div className="row gap"><button className="ghost" disabled={wait > 0} onClick={send}>{wait > 0 ? `Resend in ${wait}s` : 'Resend OTP'}</button><button className="ghost" onClick={() => { setStep('form'); setOtp(''); }}>Change amount</button></div>
    </>}
    <Msg m={m} />
  </div>;
}

function Bank({ user, setUser }) {
  const [f, setF] = useState({ amount: '', salary: '50000' }); const [m, run] = useAct(); const set = k => e => setF({ ...f, [k]: e.target.value });
  const [sw, setSw] = useState(user.sweep);
  const act = (path, body, ok) => run(async () => { const r = await api(path, path.includes('sweep') ? 'PUT' : 'POST', body); setUser(r.user); return r; }, ok);
  return <>
    <h1>Add money and bank</h1><Msg m={m} />
    {!(user.emailVerified && user.mobileVerified) && <div className="msg err">Verify your email and mobile to add money. <NavLink to="/verify">Verify now</NavLink></div>}
    <div className="grid"><Stat label="Your Invest365 account" value={user.accountNo || '...'} /><Stat label="Invest wallet" value={inr(user.wallet)} gold /></div>
    <p className="muted">Your Invest365 account opened when you signed up. After verification, pay from any bank by UPI, net banking or card.</p>
    <div className="gap">{user.kyc.status === 'verified' ? <Checkout user={user} setUser={setUser} /> : <div className="card big pay"><h2>Complete verification to add money</h2>
      <p className="muted">Adding money unlocks once your email, mobile and KYC are all verified.</p>
      {[['Email', user.emailVerified, '/verify'], ['Mobile', user.mobileVerified, '/verify'], ['PAN', user.kyc.panOk, '/kyc'], ['Aadhaar', user.kyc.aadhaarOk, '/kyc'], ['Face check', user.kyc.faceOk, '/kyc'], ['Bank account', user.kyc.bankOk, null]].map(([n, ok, to]) => <div key={n} className="kv row space"><span>{n}</span>{ok ? <span className="pill ok">Done</span> : to ? <NavLink to={to}><span className="pill warn">Do this</span></NavLink> : <span className="pill warn">Link below</span>}</div>)}</div>}</div>
    <div className="card gap"><h2>Bank details</h2>
      {user.kyc.bankOk ? <>
        <div className="kv row space"><span className="muted">Bank</span><strong>{user.bank.bankName}</strong></div><div className="kv row space"><span className="muted">Account</span><strong>****{user.bank.accountLast4}</strong></div><div className="kv row space"><span className="muted">IFSC</span><strong>{user.bank.ifsc}</strong></div>
        
      </> : <>
        <p className="muted">Link your bank here. It is one of the four KYC checks.</p>
        <label>Bank name</label><input value={f.bankName || ''} onChange={set('bankName')} /><label>Account number</label><input value={f.accountNumber || ''} onChange={set('accountNumber')} inputMode="numeric" /><label>IFSC</label><input value={f.ifsc || ''} onChange={set('ifsc')} maxLength={11} />
        <div className="gap"><button onClick={() => act('/bank/link', { bankName: f.bankName, accountNumber: f.accountNumber, ifsc: f.ifsc }, 'Bank linked')}>Link bank</button></div></>}
    </div>
    {user.kyc.bankOk && <Withdraw user={user} setUser={setUser} />}
    {user.kyc.bankOk && <div className="card gap"><h2>Salary auto-invest</h2><p className="muted">When salary arrives, save and invest these shares automatically.</p>
      <div className="row"><div><label>Save %</label><input type="number" value={sw.savePct} onChange={e => setSw({ ...sw, savePct: e.target.value })} /></div><div><label>Invest %</label><input type="number" value={sw.investPct} onChange={e => setSw({ ...sw, investPct: e.target.value })} /></div>
        <div><label>Turn on</label><select value={sw.enabled ? 'on' : 'off'} onChange={e => setSw({ ...sw, enabled: e.target.value === 'on' })}><option value="off">Off</option><option value="on">On</option></select></div></div>
      <div className="gap"><button onClick={() => act('/bank/sweep', sw, 'Rule saved')}>Save rule</button></div>
      <label>Simulate a salary credit</label><div className="row"><input style={{ maxWidth: 200 }} type="number" value={f.salary} onChange={set('salary')} /><button className="ghost" onClick={() => act('/bank/salary', { amount: f.salary }, 'Salary credited and rule applied')}>Credit salary</button></div></div>}
  </>;
}

const quiz = [
  ['How long can you stay invested?', ['Under 1 year', '1 to 3 years', 'Over 3 years']],
  ['If your portfolio fell 15%, you would', ['Sell everything', 'Wait and watch', 'Buy more']],
  ['Your main goal is', ['Protect my money', 'Steady growth', 'Highest growth']],
  ['Share of income you can invest', ['Under 10%', '10 to 25%', 'Over 25%']],
  ['Investing experience', ['None', 'Some', 'Experienced']]
];
function Invest({ user, setUser }) {
  const [plans] = useLoad('/invest/plans'); const [list, reload] = useLoad('/invest'); const [goals] = useLoad('/invest/goals');
  const [fd, setFd] = useState(null); const [ans, setAns] = useState([]); const [rec, setRec] = useState(null); const [sel, setSel] = useState({}); const [m, run] = useAct(); const [fdIn, setFdIn] = useState({ amount: 100000, months: 12 });
  const compare = () => api(`/public/fd-compare?amount=${fdIn.amount}&months=${fdIn.months}`).then(setFd);
  useEffect(() => { compare(); }, []); // eslint-disable-line
  const buy = p => run(async () => { const r = await api('/invest', 'POST', { planKey: p.key, amount: sel[p.key], goal: sel.goal || undefined }); setUser(r.user); reload(); }, 'Invested');
  const redeem = id => run(async () => { const r = await api(`/invest/${id}/redeem`, 'POST'); setUser(r.user); reload(); }, 'Redeemed to wallet');
  return <>
    <h1>Invest</h1><Msg m={m} />
    <div className="card"><h2>Risk quiz {user.risk && user.risk.profile && <span className="pill ok">{user.risk.profile}</span>}</h2>
      {quiz.map(([q, o], i) => <div key={i}><label>{q}</label><select value={ans[i] || ''} onChange={e => { const a = [...ans]; a[i] = Number(e.target.value); setAns(a); }}><option value="">Choose</option>{o.map((t, j) => <option key={j} value={j + 1}>{t}</option>)}</select></div>)}
      <div className="gap"><button disabled={ans.filter(Boolean).length < 5} onClick={() => run(async () => { const r = await api('/invest/risk', 'POST', { answers: ans }); setRec(r); setUser({ ...user, risk: r.risk }); }, 'Profile saved')}>See my profile</button></div>
      {rec && <p className="muted gap">Suggested for you: {rec.recommended.map(p => p.name).join(', ')}</p>}
    </div>
    <h2 className="gap">Plans</h2>
    <div className="grid">{plans && plans.plans.map(p => <div className="card" key={p.key}>
      <div className="row" style={{ justifyContent: 'space-between' }}><h3>{p.name}</h3><span className={'pill ' + (p.regulated ? 'ok' : 'warn')}>{p.regulated ? 'Market product' : 'Demo only'}</span></div>
      <p className="muted">{p.category}. About {p.returnPct}% a year over {p.tenureMonths} months. Minimum {inr(p.minAmount)}.</p><p className="muted">{p.note}</p>
      <input type="number" placeholder="Amount" value={sel[p.key] || ''} onChange={e => setSel({ ...sel, [p.key]: e.target.value })} />
      <div className="gap"><button onClick={() => buy(p)}>Invest</button></div></div>)}</div>
    {goals && goals.goals.length > 0 && <div className="gap"><label>Link next investment to a goal</label><select value={sel.goal || ''} onChange={e => setSel({ ...sel, goal: e.target.value })}><option value="">No goal</option>{goals.goals.map(g => <option key={g._id} value={g._id}>{g.icon} {g.name}</option>)}</select></div>}
    <Sips plans={plans && plans.plans} reload={reload} setUser={setUser} />
    <div className="card gap"><h2>FD comparison</h2>
      <div className="row"><input style={{ maxWidth: 160 }} type="number" value={fdIn.amount} onChange={e => setFdIn({ ...fdIn, amount: e.target.value })} /><input style={{ maxWidth: 120 }} type="number" value={fdIn.months} onChange={e => setFdIn({ ...fdIn, months: e.target.value })} /><button className="ghost" onClick={compare}>Compare</button></div>
      <p className="muted">Bank rates are examples. Check the bank before you decide.</p>
      <div className="tablewrap"><table><thead><tr><th>Option</th><th>Rate</th><th>Value at end</th></tr></thead><tbody>{fd && fd.rows.map(r => <tr key={r.bank}><td>{r.bank}</td><td>{r.rate}%</td><td>{inr(r.maturity)}</td></tr>)}</tbody></table></div></div>
    <div className="card gap"><h2>My investments</h2>
      <div className="tablewrap"><table><thead><tr><th>Plan</th><th>Amount</th><th>Value now</th><th>Matures</th><th>Status</th><th></th></tr></thead><tbody>
        {list && list.investments.map(i => <tr key={i._id}><td>{i.planName}</td><td>{inr(i.amount)}</td><td>{inr(i.currentValue)}</td><td>{day(i.maturityDate)}</td><td><span className={'pill ' + (i.status === 'active' ? 'warn' : 'ok')}>{i.status}</span></td><td>{i.status === 'active' && <button className="ghost" onClick={() => redeem(i._id)}>Exit early</button>}</td></tr>)}
      </tbody></table></div><p className="muted">Early exit pays the principal plus half of the interest earned so far.</p></div>
  </>;
}

function Goals() {
  const [data, load] = useLoad('/invest/goals'); const [f, setF] = useState({ icon: '🎯' }); const [m, run] = useAct();
  return <>
    <h1>Goals</h1><Msg m={m} />
    <div className="card"><div className="row"><input style={{ maxWidth: 70 }} value={f.icon} onChange={e => setF({ ...f, icon: e.target.value })} /><input style={{ maxWidth: 220 }} placeholder="Goal (Car, House, Retirement)" value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} /><input style={{ maxWidth: 160 }} type="number" placeholder="Target amount" value={f.target || ''} onChange={e => setF({ ...f, target: e.target.value })} /><input style={{ maxWidth: 170 }} type="date" onChange={e => setF({ ...f, targetDate: e.target.value })} />
      <button onClick={async () => { await run(() => api('/invest/goals', 'POST', f), 'Goal added'); load(); }}>Add goal</button></div></div>
    <div className="grid gap">{data && data.goals.map(g => <div className="card" key={g._id}><h3>{g.icon} {g.name}</h3><p className="muted">{inr(g.saved)} of {inr(g.target)}{g.targetDate && ' by ' + day(g.targetDate)}</p><div className="bar"><i style={{ width: Math.min(100, g.saved / g.target * 100) + '%' }} /></div>
      <div className="gap"><button className="ghost" onClick={async () => { await api('/invest/goals/' + g._id, 'DELETE'); load(); }}>Delete</button></div></div>)}</div>
  </>;
}

function Transactions() {
  const [t, setT] = useState(''); const [d] = useLoad('/bank/transactions' + (t ? '?type=' + t : ''), [t]);
  return <>
    <div className="row space"><h1>Transactions</h1><button className="ghost" disabled={!d || !d.transactions.length} onClick={() => downloadCsv(d.transactions)}>Download CSV</button></div>
    <select style={{ maxWidth: 220 }} value={t} onChange={e => setT(e.target.value)}><option value="">All types</option>{['deposit', 'withdrawal', 'investment', 'interest', 'redemption', 'salary', 'saving'].map(x => <option key={x}>{x}</option>)}</select>
    <div className="card gap tablewrap"><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Bank reference</th><th>Note</th></tr></thead><tbody>
      {d && d.transactions.map(x => <tr key={x._id}><td>{day(x.createdAt)}</td><td><span className={'pill ' + (x.status === 'flagged' ? 'bad' : '')}>{x.type}{x.status === 'flagged' && ' (held)'}</span></td><td>{inr(x.amount)}</td><td>{x.ref}</td><td>{x.note}</td></tr>)}
      {d && !d.transactions.length && <tr><td colSpan="5" className="muted">No transactions yet. Add money to your wallet to begin.</td></tr>}
    </tbody></table></div>
  </>;
}

function Admin() {
  const [s, reload, err] = useLoad('/admin/stats'); const [u] = useLoad('/admin/users'); const [mat] = useLoad('/admin/maturities'); const [ser] = useLoad('/admin/series'); const [m, run] = useAct();
  if (err) return <div className="msg err">{err}</div>;
  const max = s ? Math.max(1, ...Object.values(s.byPlan)) : 1;
  return <>
    <h1>Admin dashboard</h1><Msg m={m} />
    {s && <><div className="grid">
      <Stat label="Total users" value={s.users} /><Stat label="KYC verified" value={s.kycDone} /><Stat label="Total invested" value={inr(s.totalInvested)} /><Stat label="Active investments" value={s.activeCount} />
      <Stat label="Money under management" value={inr(s.aum)} gold /><Stat label="Interest paid" value={inr(s.interestPaid)} /><Stat label="Interest still owed" value={inr(s.projectedInterestLiability)} /><Stat label="Held transactions" value={s.flagged} />
    </div>
    <div className="grid gap"><div className="card"><h2>Investment by plan</h2>{Object.entries(s.byPlan).map(([k, v]) => <div key={k} style={{ marginBottom: '.6rem' }}><div className="row" style={{ justifyContent: 'space-between' }}><span>{k}</span><span>{inr(v)}</span></div><div className="bar"><i style={{ width: v / max * 100 + '%' }} /></div></div>)}</div>
      <div className="card"><h2>Maturing in 30 days</h2><p><strong>{s.maturingSoon}</strong> investments, {inr(s.maturingAmount)}</p><button className="ghost" onClick={async () => { await run(() => api('/admin/fast-forward', 'POST'), 'All investments matured'); reload(); }}>Demo: fast-forward maturity</button></div></div></>}
    {ser && <div className="grid gap"><div className="card"><h2>Money added, last 14 days</h2><BarChart data={ser.deposits} money /></div><div className="card"><h2>New users, last 14 days</h2><BarChart data={ser.signups} /></div></div>}
    <div className="card gap"><h2>Maturity tracker</h2><div className="tablewrap"><table><thead><tr><th>User</th><th>Plan</th><th>Amount</th><th>Matures</th></tr></thead><tbody>{mat && mat.investments.map(i => <tr key={i._id}><td>{i.user && i.user.name}</td><td>{i.planName}</td><td>{inr(i.amount)}</td><td>{day(i.maturityDate)}</td></tr>)}</tbody></table></div></div>
    <div className="card gap"><h2>Users</h2><div className="tablewrap"><table><thead><tr><th>Name</th><th>Mobile</th><th>KYC</th><th>Wallet</th><th>Joined</th></tr></thead><tbody>{u && u.users.map(x => <tr key={x._id}><td>{x.name}</td><td>{x.mobile}</td><td><span className={'pill ' + (x.kyc.status === 'verified' ? 'ok' : 'warn')}>{x.kyc.status}</span></td><td>{inr(x.wallet)}</td><td>{day(x.createdAt)}</td></tr>)}</tbody></table></div></div>
  </>;
}

const Line = ({ k, v }) => <div className="kv row space"><span className="muted">{k}</span><strong>{v || '-'}</strong></div>;
function Profile({ user }) {
  const k = user.kyc, steps = [['PAN', k.panOk], ['Aadhaar', k.aadhaarOk], ['Face check', k.faceOk], ['Bank account', k.bankOk]];
  if (k.status !== 'verified') return <><h1>Profile</h1><div className="card"><h2>Finish KYC to unlock your full details</h2><p className="muted">Your account number, identity and bank details show here once all four checks are done.</p>
    {steps.map(([n, ok]) => <div key={n} className="kv row space"><span>{n}</span><span className={'pill ' + (ok ? 'ok' : 'warn')}>{ok ? 'Done' : 'Pending'}</span></div>)}
    <div className="gap"><NavLink to="/kyc"><button>Continue KYC</button></NavLink></div></div></>;
  return <><h1>Profile</h1><div className="grid">
    <div className="card"><h2>Invest365 account</h2><Line k="Account number" v={user.accountNo} /><Line k="Wallet" v={inr(user.wallet)} /><Line k="Member since" v={day(user.createdAt)} /><Line k="KYC" v="Verified" /></div>
    <div className="card"><h2>Personal</h2><Line k="Name" v={user.name} /><Line k="Mobile" v={user.mobile} /><Line k="Email" v={user.email} /></div>
    <div className="card"><h2>Identity</h2><Line k="PAN" v={k.pan} /><Line k="Aadhaar" v={'XXXX XXXX ' + k.aadhaarLast4} /><Line k="Face check" v="Matched" /></div>
    <div className="card"><h2>Bank</h2><Line k="Bank" v={user.bank.bankName} /><Line k="Account" v={'****' + user.bank.accountLast4} /><Line k="IFSC" v={user.bank.ifsc} /></div>
    <div className="card"><h2>Investing</h2><Line k="Risk profile" v={user.risk && user.risk.profile} /><Line k="Salary rule" v={user.sweep.enabled ? `Save ${user.sweep.savePct}%, invest ${user.sweep.investPct}%` : 'Off'} /></div>
  </div></>;
}

const facilities = [
  ['Pay from any bank', 'Add money by UPI, net banking or card. Your account opens at sign-up, and you link your bank once during KYC.', [
    'Your Invest365 account number is created the moment you sign up. No separate account to open.',
    'Pay by UPI ID, net banking or card. There is no upper limit on the amount. The minimum is ₹100.',
    'You link your bank once during KYC. That bank is used for withdrawals.',
    'Every payment gets a bank reference number (UTR) on your receipt.']],
  ['Instant KYC', 'PAN, Aadhaar, selfie and bank checks in one place.', [
    'Four checks: PAN, Aadhaar, a selfie and your bank account.',
    'Only the last 4 digits of Aadhaar are stored. The full number never is.',
    'Verify your email and mobile first, then finish the four checks. Adding money, investing and withdrawing unlock once you are fully verified.',
    'Once verified, your full profile with account and bank details opens up.']],
  ['Salary auto-invest', 'Choose how much to save and invest when your salary lands.', [
    'Set a save share and an invest share. Together they can be up to 90%.',
    'When your salary is credited, the saved part goes to your wallet.',
    'The invest part goes into a plan that matches your risk profile, if it meets that plan’s minimum.',
    'Switch the rule on or off any time.']],
  ['Government securities and bonds', 'T-Bills, G-Secs and corporate bonds, with returns shown before you invest.', [
    'T-Bill 364 days: about 6.9% a year, 12 months, from ₹1,000.',
    'Government Security 10Y: about 7.1% a year, from ₹1,000.',
    'AAA Corporate Bond: about 8.2% a year, 24 months, from ₹5,000.',
    'Bonds carry issuer risk, and G-Sec prices move with interest rates. Rates shown are examples.']],
  ['Mutual funds', 'Liquid and index funds, starting from ₹500.', [
    'Liquid Fund: about 6.8% a year over 3 months, from ₹500. Good for money you may need soon.',
    'Nifty 50 Index Fund: about 11% a year estimated over 36 months, from ₹500.',
    'Mutual fund returns are market-linked. They can be lower, and equity can even be negative.']],
  ['FD comparison', 'See what the same amount earns across banks and other options.', [
    'Enter an amount and a period to see the value at the end for each option.',
    'Banks, an NBFC, T-Bills, G-Secs and bonds sit side by side, highest rate first.',
    'Bank rates here are examples. Check the bank’s own rate before you decide.']],
  ['Goals', 'Track a car, a house or retirement against what you have invested.', [
    'Add a goal with a name, a target amount and a date.',
    'Link an investment to a goal when you invest.',
    'A progress bar shows how close you are, using the current value of linked investments.']],
  ['Risk profile and picks', 'A five-question quiz suggests plans that fit you.', [
    'Answer five short questions about time, comfort with falls, goals, income and experience.',
    'You get a profile: conservative, moderate or aggressive.',
    'Suggested plans follow your profile, and the salary rule uses it too.']],
  ['Maturity payouts', 'Principal and interest reach your wallet when a plan ends.', [
    'When a plan matures, principal and interest are credited to your wallet automatically.',
    'Interest and principal show as separate entries in your history.',
    'Need money sooner? Withdraw any amount. Wallet money goes first, and if short, investments exit early with principal plus half of the interest earned so far.']],
  ['Full history', 'Every payment and payout with a bank reference number.', [
    'Deposits, withdrawals, investments, interest, redemptions and salary credits all in one list.',
    'Each line has a date, amount, reference number and note.',
    'Filter by type to find what you need.']]
];
function FeatureModal({ f, onClose, onStart }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return <div className="modal-bg" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" aria-label={f[0]} onClick={e => e.stopPropagation()}>
    <h2>{f[0]}</h2><p className="muted">{f[1]}</p><ul>{f[2].map(t => <li key={t}>{t}</li>)}</ul>
    <div className="row"><button onClick={onStart}>Get started</button><button className="ghost" onClick={onClose}>Close</button></div></div></div>;
}
function Home() {
  const nav = useNavigate(); const [open, setOpen] = useState(null); const [pl] = useLoad('/public/plans'); const [fd] = useLoad('/public/fd-compare?amount=100000&months=12');
  const [c, setC] = useState({ amount: 100000, months: 12, key: 'corp-bond' });
  const plan = pl && pl.plans.find(p => p.key === c.key);
  const value = plan ? Math.round(c.amount * Math.pow(1 + plan.returnPct / 100, c.months / 12)) : 0;
  const signup = () => nav('/login', { state: { tab: 'register' } });
  return <div className="home">
    {open && <FeatureModal f={open} onClose={() => setOpen(null)} onStart={signup} />}
    <header className="nav"><div className="brand">Invest<b>365</b></div><nav className="links"><a href="#features">Features</a><a href="#plans">Plans</a><a href="#calculator">Calculator</a><a href="#security">Security</a><a href="#faq">FAQ</a></nav><div className="row"><button className="ghost" onClick={() => nav('/login')}>Log in</button><button onClick={signup}>Sign up free</button></div></header>
    <section className="hero" id="calculator">
      <div><h1 className="big">Your salary arrives. Saving and investing happen on their own.</h1>
        <p className="muted" style={{ fontSize: '1.05rem' }}>Pay from your bank, finish KYC online, and put money into bonds, mutual funds and government securities, all from one dashboard.</p>
        <div className="row gap"><button onClick={signup}>Open my account</button><button className="ghost" onClick={() => nav('/login')}>I already have one</button></div></div>
      <div className="card big"><h2>See what your money could earn</h2>
        <label>Amount</label><input type="number" value={c.amount} onChange={e => setC({ ...c, amount: Number(e.target.value) })} />
        <label>Plan</label><select value={c.key} onChange={e => setC({ ...c, key: e.target.value })}>{pl && pl.plans.map(p => <option key={p.key} value={p.key}>{p.name} ({p.returnPct}%)</option>)}</select>
        <label>Months</label><select value={c.months} onChange={e => setC({ ...c, months: Number(e.target.value) })}>{[3, 6, 12, 24, 36, 60].map(m => <option key={m}>{m}</option>)}</select>
        <div className="stat gap"><small>Estimated value</small><strong style={{ color: 'var(--gold)' }}>{inr(value)}</strong></div>
        <p className="muted">An estimate only. Market products can earn less.</p></div>
    </section>
    <div className="stats"><div><strong>₹500</strong><span>Lowest starting amount</span></div><div><strong>3 ways</strong><span>To pay: UPI, net banking, card</span></div><div><strong>4 steps</strong><span>Online KYC: PAN, Aadhaar, selfie, bank</span></div><div><strong>6 plans</strong><span>Bonds, funds and government securities</span></div></div>
    <section id="features"><h2>Everything in one place</h2><div className="grid">{facilities.map(f => <button className="tile" key={f[0]} onClick={() => setOpen(f)}><h3>{f[0]}</h3><p className="muted" style={{ margin: 0 }}>{f[1]}</p><small style={{ color: 'var(--gold)' }}>Tap for details</small></button>)}</div></section>
    <section id="plans"><h2>Plans</h2><div className="card tablewrap"><table><thead><tr><th>Plan</th><th>Type</th><th>Return a year</th><th>Period</th><th>Minimum</th></tr></thead><tbody>{pl && pl.plans.map(p => <tr key={p.key}><td>{p.name}</td><td>{p.category}</td><td>{p.returnPct}%</td><td>{p.tenureMonths} months</td><td>{inr(p.minAmount)}</td></tr>)}</tbody></table></div></section>
    <section><h2>₹1,00,000 for 12 months</h2><div className="card tablewrap"><table><thead><tr><th>Option</th><th>Rate</th><th>Value at end</th></tr></thead><tbody>{fd && fd.rows.map(r => <tr key={r.bank}><td>{r.bank}</td><td>{r.rate}%</td><td>{inr(r.maturity)}</td></tr>)}</tbody></table></div></section>
    <section><h2>How it works</h2><div className="grid">{[['Sign up', 'Your Invest365 account number is ready right away.'], ['Add money', 'Pay by UPI, net banking or card.'], ['Complete KYC', 'PAN, Aadhaar, selfie, bank.'], ['Invest', 'Pick a plan or turn on the salary rule.']].map(([t, d], i) => <div className="card" key={t}><h3>{i + 1}. {t}</h3><p className="muted" style={{ margin: 0 }}>{d}</p></div>)}</div></section>
    <section id="security"><h2>Built to keep your details safe</h2><div className="grid">{[['Passwords are hashed', 'Stored with bcrypt, never in plain text.'], ['Aadhaar is masked', 'Only the last 4 digits are kept. The full number never is.'], ['Protected sessions', 'Signed login tokens, and rate limits on login and OTP.'], ['Verified payments', 'Gateway payments are checked by signature on our server before money is credited.']].map(([t, d]) => <div className="card" key={t}><h3>{t}</h3><p className="muted" style={{ margin: 0 }}>{d}</p></div>)}</div></section>
    <section id="faq" className="faq"><h2>Questions</h2>{[['Do I need to open a separate bank account?', 'No. Your Invest365 account opens when you sign up, and you link your bank once during KYC.'], ['Can I take my money out any time?', 'Yes. Withdraw any amount to your bank. Wallet money goes first. If it falls short, investments exit early for the rest, and you see the exact terms before you confirm. Each withdrawal is confirmed with an OTP sent to your email and phone.'], ['Are the returns guaranteed?', 'No. Rates shown are examples. Government securities are sovereign-backed, but bonds carry issuer risk and mutual funds are market-linked.'], ['What is KYC and why is it needed?', 'It confirms who you are with PAN, Aadhaar, a selfie and your bank account. Adding money, investing and withdrawing unlock once your email, mobile and KYC are all verified.'], ['Is this a live product?', 'This is a demo build. No real money moves. A live launch needs licensed partners for KYC, payments and investments.']].map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
    <footer className="foot"><div><div className="brand">Invest<b>365</b></div><p className="muted">Save and invest from your salary, all in one place. Demo project: rates and returns are examples and not a guarantee. Investments carry risk. A real launch needs RBI and SEBI licensed partners.</p></div>
      <div><h3>Explore</h3><a href="#features">Features</a><a href="#plans">Plans</a><a href="#calculator">Calculator</a></div><div><h3>Help</h3><a href="#security">Security</a><a href="#faq">FAQ</a><a href="/login">Log in</a></div></footer>
  </div>;
}

export default function App() {
  const [user, setUser] = useState(null); const [ready, setReady] = useState(false); const nav = useNavigate();
  useEffect(() => { if (localStorage.getItem('token')) api('/auth/me').then(r => setUser(r.user)).catch(() => {}).finally(() => setReady(true)); else setReady(true); }, []);
  if (!ready) return null;
  if (!user) return <Routes><Route path="/" element={<Home />} /><Route path="/login" element={<Auth onAuth={u => { setUser(u); nav(u.role === 'admin' || (u.emailVerified && u.mobileVerified) ? '/' : '/verify'); }} />} /><Route path="*" element={<Navigate to="/" />} /></Routes>;
  const logout = () => { localStorage.removeItem('token'); setUser(null); nav('/'); };
  return <div className="shell">
    <nav className="side"><div className="brand">Invest<b>365</b></div>
      <NavLink to="/" end>Dashboard</NavLink><NavLink to="/bank">Add money and bank</NavLink>{user.role !== 'admin' && !(user.emailVerified && user.mobileVerified) && <NavLink to="/verify">Verify contact</NavLink>}<NavLink to="/kyc">KYC</NavLink><NavLink to="/invest">Invest</NavLink><NavLink to="/goals">Goals</NavLink><NavLink to="/transactions">Transactions</NavLink><NavLink to="/profile">Profile</NavLink>
      {user.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}<div className="grow" /><button className="ghost" onClick={logout}>Log out</button></nav>
    <main><div className="appbar"><span className={'pill ' + (user.kyc.status === 'verified' ? 'ok' : 'warn')}>KYC {user.kyc.status}</span><NavLink to="/profile" className="avatar" aria-label="Profile">{user.name[0].toUpperCase()}</NavLink></div><Routes>
      <Route path="/" element={<Dashboard user={user} />} /><Route path="/kyc" element={<Kyc user={user} setUser={setUser} />} /><Route path="/bank" element={<Bank user={user} setUser={setUser} />} />
      <Route path="/invest" element={<Invest user={user} setUser={setUser} />} /><Route path="/goals" element={<Goals />} /><Route path="/transactions" element={<Transactions />} />
      <Route path="/profile" element={<Profile user={user} />} /><Route path="/verify" element={<Verify user={user} setUser={setUser} />} />
      <Route path="/admin" element={user.role === 'admin' ? <Admin /> : <Navigate to="/" />} /><Route path="*" element={<Navigate to="/" />} />
    </Routes></main></div>;
}
