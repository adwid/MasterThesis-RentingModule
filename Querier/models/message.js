const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    date: {type: Date, default: Date.now, required: true},
    url: {type: String, required: true},
    to: {type: String, required: true},
    seen: {type: Boolean, required: true, default: false},
});

MessageSchema.index({to: 1, seen: 1});
MessageSchema.index({to: 1, date: 1});

module.exports = mongoose.model('Message', MessageSchema);
