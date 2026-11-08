require('dotenv').config();
const express = require('express'), mongoose = require('mongoose'), cors = require('cors');
const helmet = require('helmet'), rateLimit = require('express-rate-limit');
const { processMaturities } = require('./services/maturity');
const { processSips } = require('./services/sip');

if (!process.env.JWT_SECRET || !process.env.MONGO_URI) { console.error('Copy .env.example to .env and fill it in'); process.exit(1); }
const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));
app.use('/api', rateLimit({ windowMs: 60000, max: 200 }));
app.use('/api/auth', rateLimit({ windowMs: 60000, max: 20 }), require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/pay', require('./routes/payment'));
app.use('/api/kyc', require('./routes/kyc'));
app.use('/api/bank', require('./routes/bank'));
app.use('/api/invest', require('./routes/invest'));
app.use('/api/admin', require('./routes/admin'));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { if (!err.status) console.error(err); res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong' }); });

mongoose.connect(process.env.MONGO_URI).then(() => {
  app.listen(process.env.PORT || 5000, () => console.log('API running on port ' + (process.env.PORT || 5000)));
  processMaturities(); processSips();
  setInterval(() => { processMaturities(); processSips(); }, 3600000);
}).catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
