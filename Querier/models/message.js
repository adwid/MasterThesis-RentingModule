const mongoose = require('mongoose');

let MessageSchema = new mongoose.Schema({
    _id: String,
    id: String
}, {
    strict: false
});

MessageSchema.index({id: 1}, {unique: true});
MessageSchema.index({"object.id": 1}, {unique: true});

module.exports = mongoose.model('Message', MessageSchema);
