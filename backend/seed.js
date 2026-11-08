require('dotenv').config();
const mongoose = require('mongoose'), bcrypt = require('bcryptjs');
const { User } = require('./models');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteOne({ email: 'admin@invest365.com' });
  await User.create({ name: 'Admin', mobile: '9999999999', email: 'admin@invest365.com', password: await bcrypt.hash('Admin@12345', 10), role: 'admin' });
  console.log('Admin ready -> admin@invest365.com / Admin@12345 (change this password)');
  process.exit(0);
})();
