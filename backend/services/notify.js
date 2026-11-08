// Email (SMTP, e.g. Gmail) and SMS (Twilio or Fast2SMS). Nothing here ever throws into a request:
// if a channel is not configured it is skipped, and with no channel at all the message is printed in the terminal.
const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let mailer;

const emailOn = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);
const smsOn = () => ['twilio', 'fast2sms'].includes((process.env.SMS_PROVIDER || '').toLowerCase());

async function sendEmail(to, subject, text) {
  if (!emailOn()) return false;
  if (!mailer) {
    const port = Number(process.env.SMTP_PORT) || 465;
    mailer = require('nodemailer').createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  }
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:16px"><h2 style="color:#0d3b4c;margin:0 0 12px">Invest<span style="color:#e59f00">365</span></h2><p style="font-size:15px;line-height:1.5;color:#222">${esc(text).replace(/\n/g, '<br>')}</p><hr style="border:0;border-top:1px solid #ddd"><small style="color:#777">Demo project. Never share your OTP with anyone.</small></div>`;
  await mailer.sendMail({ from: process.env.MAIL_FROM || `Invest365 <${process.env.SMTP_USER}>`, to, subject, text, html });
  return true;
}

async function sendSms(mobile, text) {
  const p = (process.env.SMS_PROVIDER || '').toLowerCase();
  if (p === 'twilio') {
    const { TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM } = process.env;
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: '+91' + mobile, From: TWILIO_FROM, Body: text }) });
    if (!r.ok) throw new Error('Twilio: ' + (await r.text()).slice(0, 200));
    return true;
  }
  if (p === 'fast2sms') {
    const r = await fetch('https://www.fast2sms.com/dev/bulkV2', { method: 'POST', headers: { authorization: process.env.FAST2SMS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'q', message: text, language: 'english', flash: 0, numbers: mobile }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.return === false) throw new Error('Fast2SMS: ' + JSON.stringify(d).slice(0, 200));
    return true;
  }
  return false;
}

// channels: which to use (default both). Returns { email, sms } = what actually went out.
async function notify(user, { subject, text, sms, channels = ['email', 'sms'] }) {
  const out = { email: false, sms: false };
  const jobs = [];
  if (channels.includes('email')) jobs.push(sendEmail(user.email, subject, text).then(v => { out.email = v; }));
  if (channels.includes('sms')) jobs.push(sendSms(user.mobile, sms || text).then(v => { out.sms = v; }));
  (await Promise.allSettled(jobs)).forEach(r => r.status === 'rejected' && console.error('[notify] failed:', r.reason.message));
  if (!out.email && !out.sms) console.log(`[NOTIFY dev] to ${user.email} / ${user.mobile} | ${subject}: ${text}`);
  return out;
}
const fire = (user, msg) => { notify(user, msg).catch(() => {}); }; // do not wait for it

module.exports = { notify, fire };
