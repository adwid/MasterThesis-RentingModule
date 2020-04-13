const mongoose = require('mongoose');

const RentalSchema = new mongoose.Schema({
    concern: {type: String, required: true},
    from: {type: Date, required: true},
    to: {type: Date, required: true},
    by: {type: String, required: true},
    made: {type: Date, required: true},
});

RentalSchema.index({concern:1, from: 1, to:1, by: 1}, {unique: true});

module.exports = mongoose.model('Rental', RentalSchema);
