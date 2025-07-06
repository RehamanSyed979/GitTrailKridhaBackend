const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');



const app = express();

// --- CORS PATCH: Allow frontend to access backend from any origin (for dev/deploy) ---
// For production, restrict the origin array below to your frontend domains

// --- CORS PATCH: Allow all origins for debugging and Vercel preview deploys ---
app.use(cors({
  origin: [
    'https://git-trail-kridha.vercel.app', // production frontend
    'http://localhost:3000',              // local React dev (optional)
    'http://127.0.0.1:5500'               // local static HTML (your case)
  ],
  credentials: true
}));

app.use(bodyParser.json());

// Use MongoDB Atlas for cloud database
mongoose.connect('mongodb+srv://rehamansyed979:Syed%40786786@kridharealty.v71poy0.mongodb.net/KridhaRealty?retryWrites=true&w=majority', {});

const userSchema = new mongoose.Schema({
  mobile: { type: String, unique: true, required: true },
  email: String,
  password: String,
  name: String,
  role: { type: String, default: 'user' },
  createdAt: { type: Date, default: Date.now },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ad' }]
});
// In-memory OTP store (for demo only)
const otpStore = {};

// Send OTP (Firebase Auth should be used on the frontend for phone verification)
app.post('/api/send-otp', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ error: 'Mobile required' });
  if (await User.findOne({ mobile })) return res.status(400).json({ error: 'Mobile already registered' });
  // In Firebase Auth, OTP is handled on the frontend. This endpoint is now a placeholder.
  res.json({ success: true, message: 'Use Firebase Authentication for phone OTP.' });
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
  const { mobile, otp } = req.body;
  if (otpStore[mobile] && otpStore[mobile] === otp) {
    delete otpStore[mobile];
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid OTP' });
  }
});
const User = mongoose.model('User', userSchema);

// Auto-create admin user if not exists
async function ensureAdminUser() {
  const adminEmail = 'admin@kridha.com';
  const adminPassword = 'Admin123';
  const adminName = 'Admin';
  const adminMobile = '9999999999';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(adminPassword, 10);
    admin = new User({
      mobile: adminMobile,
      email: adminEmail,
      password: hash,
      name: adminName,
      role: 'admin'
    });
    await admin.save();
    console.log('Admin user created:', adminEmail);
  }
}
ensureAdminUser();

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { mobile, email, password, name } = req.body;
    if (await User.findOne({ mobile })) return res.status(400).json({ error: 'Mobile already registered' });
    if (await User.findOne({ email })) return res.status(400).json({ error: 'Email exists' });
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ mobile, email, password: hash, name });
    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    email = (email || '').trim().toLowerCase();
    console.log('LOGIN ATTEMPT:', { email });
    // Master admin login (secure)
    if (email === 'admin@kridha.com') {
      console.log('Master admin login attempt');
      let user = await User.findOne({ email: 'admin@kridha.com' });
      if (!user) {
        user = new User({
          mobile: '9999999999',
          email: 'admin@kridha.com',
          password: await bcrypt.hash('Admin123', 10),
          name: 'Admin',
          role: 'admin',
          favorites: []
        });
        await user.save();
        console.log('Master admin created in DB');
      }
      const passOk = await bcrypt.compare(password, user.password);
      if (!passOk) {
        console.log('Master admin password incorrect');
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      console.log('Master admin login success');
      return res.json({ success: true, user: { _id: user._id, email: user.email, name: user.name, role: user.role, mobile: user.mobile, favorites: user.favorites || [] } });
    }
    // Normal user login
    console.log('Normal user login attempt');
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found');
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const passOk = await bcrypt.compare(password, user.password);
    if (!passOk) {
      console.log('User password incorrect');
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    console.log('Normal user login success');
    res.json({ success: true, user: { _id: user._id, email: user.email, name: user.name, role: user.role, mobile: user.mobile } });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Get all users (admin only)
app.get('/api/users', async (req, res) => {
  const users = await User.find({}, '-password');
  res.json(users);
});

// Set user role (admin only)
app.post('/api/setrole', async (req, res) => {
  const { email, role } = req.body;
  await User.updateOne({ email }, { role });
  res.json({ success: true });
});

// Delete user (admin only)
app.post('/api/delete', async (req, res) => {
  const { email } = req.body;
  await User.deleteOne({ email });
  res.json({ success: true });
});

// Mobile OTP Login (returns user by mobile, for Firebase OTP flow)
app.post('/api/login-mobile', async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ error: 'Mobile required' });
    const user = await User.findOne({ mobile });
    if (!user) return res.status(404).json({ error: 'Mobile not registered' });
    // Remove sensitive fields
    const { password, ...userSafe } = user.toObject();
    res.json({ user: userSafe });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


// --- Property Ads API ---
const Ad = require('./adModel');

// Get all ads (optionally filter by location)
app.get('/api/ads', async (req, res) => {
  const { location } = req.query;
  let filter = {};
  if (location) filter.location = location;
  const ads = await Ad.find(filter).populate('seller', 'name email mobile');
  res.json(ads);
});

// Post a new ad (seller only)
app.post('/api/ads', async (req, res) => {
  try {
    const { title, description, price, location, images, sellerId } = req.body;
    if (!title || !price || !sellerId) return res.status(400).json({ error: 'Missing required fields' });
    const ad = new Ad({ title, description, price, location, images, seller: sellerId });
    await ad.save();
    res.json({ success: true, ad });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Favorites API ---
// Add/remove favorite ad for user
app.post('/api/favorite', async (req, res) => {
  try {
    console.log('[POST /api/favorite] Body:', req.body);
    console.log('[POST /api/favorite] Headers:', req.headers);
    const { userId, adId } = req.body;
    if (!userId || !adId) {
      console.error('Missing userId or adId');
      return res.status(400).json({ error: 'Missing userId or adId' });
    }
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    // Check if ad exists
    const ad = await Ad.findById(adId);
    if (!ad) {
      console.error('Ad not found:', adId);
      return res.status(404).json({ error: 'Ad not found' });
    }
    user.favorites = user.favorites || [];
    // Ensure all favorites are stored as ObjectId (not string)
    const adIdObj = new mongoose.Types.ObjectId(adId);
    const idx = user.favorites.findIndex(fav => fav.toString() === adIdObj.toString());
    if (idx === -1) {
      user.favorites.push(adIdObj);
      await user.save();
      console.log(`Added favorite: user ${userId}, ad ${adId}`);
      return res.json({ success: true, action: 'added' });
    } else {
      user.favorites.splice(idx, 1);
      await user.save();
      console.log(`Removed favorite: user ${userId}, ad ${adId}`);
      return res.json({ success: true, action: 'removed' });
    }
  } catch (err) {
    console.error('Error in /api/favorite:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Get user's favorite ads
app.get('/api/favorites', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const user = await User.findById(userId);
  if (!user || !user.favorites) return res.json([]);
  const ads = await Ad.find({ _id: { $in: user.favorites } });
  res.json(ads);
});

// --- Image Delete Endpoint (S3 only) ---
// Delete an ad by ID (does NOT delete from local uploads folder, only from DB and S3 if you add S3 delete logic)
app.delete('/api/ads/:id', async (req, res) => {
  try {
    const adId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({ error: 'Invalid ad ID' });
    }
    const ad = await Ad.findByIdAndDelete(adId);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    // Optionally: Add S3 delete logic here if you want to remove images from S3
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting ad:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// --- S3 Upload Route ---
const uploadRouter = require('./upload');
app.use('/api', uploadRouter);

app.listen(3000, '0.0.0.0', () => console.log('Server running on http://0.0.0.0:3000'));
