const mongoose = require('mongoose');

const RentalSchema = new mongoose.Schema({
    _id: String,
    concern: {type: String, required: true, ref: 'Property'},
    from: {type: Date, required: true},
    to: {type: Date, required: true},
    by: {type: String, required: true},
    made: {type: Date, required: true},
    accepted: {type: Boolean},
});

RentalSchema.index({concern:1, from: 1, to:1, by: 1}, {unique: true});
RentalSchema.index({by: 1});

module.exports = mongoose.model('Rental', RentalSchema);
