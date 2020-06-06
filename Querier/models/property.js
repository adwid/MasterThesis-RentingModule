const mongoose = require('mongoose');
const RentalModel = require('./rental');
const CommentModel = require('./comment');

const PropertySchema = new mongoose.Schema({
    _id: String,
    name: {type: String, required: true},
    province: {type: String, required: true},
    city: {type: String, required: true},
    capacity: {type: Number, required: true, min: 1},
    price: {type: Number, min: 0, required: true},
    owner: {type: String, required: true},
    showers: {type: Number, required: true, min: 0},
    meadow: {type: Boolean, required: true},
    local: {type: Boolean, required: true},
    kitchen: {type: Boolean, required: true},
    campfire: {type: Boolean, required: true},
    description: {type: String, default: ""},
    rentals: {type: [{type: String, ref: RentalModel.modelName}], default: []},
    waitingList: {type: [{type: String, ref: RentalModel.modelName}], default: []},
    comments: {type: [{type: mongoose.Types.ObjectId, ref: CommentModel.modelName}], default: []},
});

PropertySchema.index({owner: 1, name: 1}, {unique: true});
PropertySchema.index({province: 1, city: 1, name: 1}, {unique: true});

module.exports = mongoose.model('Property', PropertySchema);
