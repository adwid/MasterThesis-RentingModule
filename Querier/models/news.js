const mongoose = require('mongoose');

const NewsSchema = new mongoose.Schema({
    date: {type: Date, default: Date.now, required: true},
    message: {type: String, required: true},
    to: {type: String, required: true},
    seen: {type: Boolean, required: true, default: false},
});

NewsSchema.index({to: 1, seen: 1});
NewsSchema.index({to: 1, date: 1});

module.exports = mongoose.model('News', NewsSchema);
