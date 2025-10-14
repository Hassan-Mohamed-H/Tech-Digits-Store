const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { connectDB } = require('./src/config/db');


const authRoutes = require('./src/routes/auth.routes');
const userRoutes = require('./src/routes/user.routes');
const productRoutes = require('./src/routes/product.routes');
const categoryRoutes = require('./src/routes/category.routes');
const orderRoutes = require('./src/routes/order.routes');
const reviewRoutes = require('./src/routes/review.routes');
const paymentRoutes = require('./src/routes/payment.routes');
const adminRoutes = require('./src/routes/admin.routes');
const OtpToken = require('./src/models/OtpToken');



const app = express();


app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://tech-digits-store-ajcdd4evceh3d9bm.canadacentral-01.azurewebsites.net',
    'https://delightful-dune-056da9b0f.1.azurestaticapps.net'
  ],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(morgan('dev'));


app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

<<<<<<< HEAD
<<<<<<< HEAD
// const frontendPath = path.resolve(__dirname, '../frontend');
// app.use(express.static(frontendPath));

// app.get('/admin/dashboard', (req, res) => {
//   res.sendFile(path.join(frontendPath, 'admin.html'));
// });

// app.get('*', (req, res) => {
//   res.sendFile(path.join(frontendPath, 'index.html'));
// });
=======
=======
>>>>>>> 8b72363b1b3d449bb0a5c6cebe497fbbc0359b87
const frontendPath = path.resolve(__dirname, '../frontend');
app.use(express.static(frontendPath));

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(frontendPath, 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
<<<<<<< HEAD
>>>>>>> 30e9bc66623856d1315e95d4e8f0f5568fab24a2
=======
>>>>>>> 8b72363b1b3d449bb0a5c6cebe497fbbc0359b87


const start = async () => {
  await connectDB();


  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => console.log(` Server running on port ${PORT}`));

 
  const runCleanup = async () => {
    try {
      const now = new Date();
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const expiredDel = await OtpToken.deleteMany({ expiresAt: { $lt: now }, verified: { $ne: true } });
      const verifiedDel = await OtpToken.deleteMany({ verified: true, updatedAt: { $lt: fiveMinAgo } });
      const count = (expiredDel.deletedCount || 0) + (verifiedDel.deletedCount || 0);
      if (count) console.log(` OTP cleanup: deleted ${count} expired codes.`);
    } catch (e) {
      console.warn(' OTP cleanup error:', e.message);
    }
  };
  setTimeout(runCleanup, 60 * 1000);
  setInterval(runCleanup, 10 * 60 * 1000);
};

start();
