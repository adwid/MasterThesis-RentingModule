const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
    content: {type: String, minLength: 1, maxLength: 300, required: true},
    by: {type: String, required: true},
    date: {type: Date, required: true},
    concern: {type: String, ref: 'Property'}
});

module.exports = mongoose.model('Comment', CommentSchema);
