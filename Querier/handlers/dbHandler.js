const PropertyModel = require('../models/property');
const RentalModel = require('../models/rental');

function createNewProperty(noteObject) {
    var content = noteObject.content;
    content._id = noteObject.id;
    const newProperty = new PropertyModel(content);
    return newProperty.save();
}

function bookProperty(noteObject) {
    const content = noteObject.content;

    return PropertyModel.findById(content.property).populate('rentals')
        .then(doc => {
            if (!doc) return Promise.resolve({err: "Property does not exist"});
            var index = searchIndexOfPreviousRental(doc.rentals, content.from, content.to);
            if (index === -2) return Promise.resolve({err: "This booking is in conflict with another one"}); // todo test ! (need the ability to accept a booking)

            const rental = new RentalModel({
                concern: content.property,
                from: content.from,
                to: content.to,
                by: noteObject.attributedTo,
                made: (new Date()).toISOString(),
            });

            return rental.save() // todo catch duplicates
        })
        .then(doc => {
            if (!doc) return Promise.reject("Rental saved but no document -> Adding it to waitingList is impossible");
            return PropertyModel.findOneAndUpdate({
                _id: content.property
            }, {
                $addToSet: {
                    waitingList: doc._id
                }
            });
        });
}

function searchIndexOfPreviousRental(rentals, from, to) {
    if (to < from) return -2;
    return searchHelper(rentals, from, to, 0, rentals.length - 1);
}

function searchHelper(rentals, from, to, start, end) {
    if (start > end) return end;

    let mid=Math.floor((start + end)/2);
    let midRental = rentals[mid];

    if (from >= midRental.from && to <= midRental.to) return -2;
    if (to <= midRental.from)
        return searchHelper(rentals, from, to, start, mid-1);
    if (from >= midRental.to)
        return searchHelper(rentals, from, to, mid+1, end);
    return -2;
}

module.exports = {
    bookProperty,
    createNewProperty,
};
