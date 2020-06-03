const mongoose = require('mongoose');

let APMessageSchema = new mongoose.Schema({
    _id: String,
    id: String
}, {
    strict: false
});

APMessageSchema.index({id: 1}, {unique: true});
APMessageSchema.index({"object.id": 1}, {unique: true});

const APMessageModel = mongoose.model('APMessage', APMessageSchema);

function getActivity(id) {
    return APMessageModel.findOne({
        $or: [
            {id: id},
            {"object.id": id}
        ]
    }, "-_id -__v")
}

function storeActivity(activity) {
    const message = new APMessageModel(activity);
    message._id = activity.id
    return message.save();
}

module.exports = {
    getActivity,
    storeActivity,
}
