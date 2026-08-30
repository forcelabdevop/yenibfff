const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  img: { type: String, required: true },
  mobileImg: { type: String, default: '' },
  games: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Games' }],
  isActive: { type: Boolean, default: true, index: true },
  showOnHomepage: { type: Boolean, default: true, index: true },
  order: { type: Number, default: 0, index: true },
  gameSelectionMode: { type: String, enum: ['dynamic', 'manual'], default: 'dynamic' },
  gameLimit: { type: Number, min: 1, max: 100, default: 20 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

CategorySchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

CategorySchema.index({ created_at: -1 });

module.exports = mongoose.model('Category', CategorySchema);
