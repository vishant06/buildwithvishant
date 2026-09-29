import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import User from './models/User.js';

dotenv.config();

await connectDB();

const email = process.env.ADMIN_EMAIL;
if (!email || !process.env.ADMIN_PASSWORD) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
}

const existing = await User.findOne({ email });
if (existing) {
  console.log(`Admin already exists: ${email}`);
} else {
  await User.create({
    name: process.env.ADMIN_NAME || 'Vishant Kumar',
    email,
    password: process.env.ADMIN_PASSWORD,
  role: 'admin',
  username: process.env.ADMIN_USERNAME || 'admin'
  });
  console.log(`Admin created: ${email}`);
}

await mongoose.disconnect();
