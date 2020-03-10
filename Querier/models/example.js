const mongoose = require('mongoose');

const ExampleSchema = new mongoose.Schema({
    name: {type: String, required: true},
    description: {type: String, default: ""},
    quantity: Number
});

module.exports = mongoose.model('Example', ExampleSchema);
