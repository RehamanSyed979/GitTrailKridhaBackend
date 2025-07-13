const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  location: String,
  images: [String],
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Add all possible fields from the post ad form
  bhk: Number,
  bathrooms: Number,
  furnishing: String,
  projectStatus: String,
  lister: String,
  superBuiltup: Number,
  carpetArea: Number,
  maintenance: Number,
  totalFloors: Number,
  floorNo: Number,
  carParking: Number,
  facing: String,
  projectName: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ad', adSchema);
