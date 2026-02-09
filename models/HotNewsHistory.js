const mongoose = require('mongoose');

const HotNewsHistorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['weibo', 'toutiao', 'douyin', 'networkhot'],
    index: true
  },
  heat: {
    type: Number,
    default: 0
  },
  rank: {
    type: Number,
    default: 0
  },
  snapshotTime: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  content: {
    text: String,
    articles: [{
      title: String,
      url: String,
      source: String
    }],
    imageUrl: String
  }
});

HotNewsHistorySchema.index({ platform: 1, snapshotTime: -1 });
HotNewsHistorySchema.index({ title: 'text' });

module.exports = mongoose.model('HotNewsHistory', HotNewsHistorySchema);
