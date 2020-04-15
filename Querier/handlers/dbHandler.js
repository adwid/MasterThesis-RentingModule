const PropertyModel = require('../models/property');
const RentalModel = require('../models/rental');

function acceptRentals(noteObject) {
    const ownerID = noteObject.attributedTo;
    const propertyID = noteObject.content.property;
    let acceptedBookingsIDs = noteObject.content.bookings;
    let findRequest = {
        _id: propertyID,
        owner: ownerID
    };

    PropertyModel
        .findOne(findRequest)
        .populate('waitingList')
        .then(property => {
            if (!property) return Promise.resolve();

            const acceptedBookings = [];
            let tmp = [];
            for (var booking of property.waitingList) { // get objects and filter unexisting IDs
                if (acceptedBookingsIDs.includes(booking._id.toString())) {
                    tmp.push(booking._id);
                    acceptedBookings.push(booking);
                }
            }
            acceptedBookingsIDs = tmp;

            const obsoleteBookingsIDs = getObsoleteBookingsID(acceptedBookings, property.waitingList);
            const bookingsToRemove = [...acceptedBookingsIDs, ...obsoleteBookingsIDs];

            const updateRequest = {
                $addToSet: {
                    rentals: {
                        $each: acceptedBookingsIDs
                    }
                },
                $pull: {
                    waitingList: {$in: bookingsToRemove}
                }
            };

            deleteRentals(obsoleteBookingsIDs); // todo inform bookers !
            return PropertyModel.findOneAndUpdate(findRequest, updateRequest);
        });
}

function cancelBooking(noteObject) {
    const bookingID = noteObject.content.booking;
    const userID = noteObject.attributedTo;

    return RentalModel.findOne({
        _id: bookingID,
        by: userID
    })
        .populate('concern') // get the property
        .then(rental => {
            const property = rental.concern;
            return PropertyModel.findOneAndUpdate({
                _id: property._id
            }, {
                $pull: {
                    rentals: {$in: [bookingID]},
                    waitingList: {$in: [bookingID]}
                }
            });
        })
        .then(_ => {
            return deleteRentals([bookingID]);
        });
}

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
            content.from = resetTime(content.from);
            content.to = resetTime(content.to);

            if (!doc) return Promise.reject({requestErr: "Property does not exist"});
            var index = searchIndexOfPreviousRental(doc.rentals, content.from, content.to);
            if (index === -2) return Promise.reject({requestErr: "This booking is in conflict with another one"});

            const rental = new RentalModel({
                concern: content.property,
                from: content.from,
                to: content.to,
                by: noteObject.attributedTo,
                made: (new Date()).toISOString(),
            });

            return rental.save()
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
        })
        .catch(err => {
            if (!!err && err.errmsg.includes("duplicate")) {
                err = {
                    requestErr: "This booking already exists"
                }
            }
            if (!!err && !!err.requestErr) {
                console.log("Error with the request: " + err.requestErr);
                // todo inform the request's user
                return Promise.resolve();
            }
            return Promise.reject(err);
        });
}

function getOwnersProperties(owner) {
    return PropertyModel.find({owner: owner});
}

function getPropertyDetails(owner, property) {
    return PropertyModel.findOne({
        _id: property,
        owner: owner
    })
        .populate('rentals')
        .populate('waitingList');
}

function rejectBookings(noteObject) {
    const ownerID = noteObject.attributedTo;
    const propertyID = noteObject.content.property;
    const rejectedBookingsIDs = noteObject.content.bookings;
    return PropertyModel.findOneAndUpdate({
        _id: propertyID,
        owner: ownerID
    }, {
        $pull: {
            rentals: {$in: rejectedBookingsIDs},
            waitingList: {$in: rejectedBookingsIDs}
        }
    }).then(doc => {
        // filter IDs that are actually not part of the waitingList/rentals
        const correctlyRejected = [];
        for (const elem of doc.waitingList) {
            if (rejectedBookingsIDs.includes(elem.toString()))
                correctlyRejected.push(elem);
        }
        for (const elem of doc.rentals) {
            if (rejectedBookingsIDs.includes(elem.toString()))
                correctlyRejected.push(elem);
        }
        deleteRentals(correctlyRejected);
        return Promise.resolve("ok");
    });
}

/*-------------------------------------------------------------*/
/* PRIVATE FUNCTIONS */
/*-------------------------------------------------------------*/

function getObsoleteBookingsID(acceptedBookings, allBookings) {
    const obsoleteBookingsID = [];
    for (const booking of allBookings) {
        if (acceptedBookings.includes(booking)) {
            continue;
        }
        if (booking.from < (new Date()).toISOString()) {
            obsoleteBookingsID.push(booking._id);
        } else {
            for (const acceptedBooking of acceptedBookings) {
                //
                // Negation of next condition (thanks to De Morgan Theorem)
                // if ((booking.from < acceptedBooking.from && booking.to <= acceptedBooking.from)
                //     || (booking.from >= acceptedBooking.to && booking.to > acceptedBooking.to))
                //
                if ((booking.from >= acceptedBooking.from || booking.to > acceptedBooking.from)
                    && (booking.from < acceptedBooking.to || booking.to <= acceptedBooking.to)) {
                    obsoleteBookingsID.push(booking._id);
                    break;
                }
            }
        }
    }
    return obsoleteBookingsID;
}

function deleteRentals(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    return RentalModel.deleteMany({
        _id: {$in: ids}
    }).catch(err => {
        console.error("Err while trying to delete some rentals : " + err);
        return Promise.reject(err);
    });
}

function searchIndexOfPreviousRental(rentals, from, to) {
    if (to < from) return -2;
    from = new Date(from);
    to = new Date(to);
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

function resetTime(dateISOString) {
    var part = dateISOString.split("T");
    return part[0] + "T00:00:00.000Z"
}

module.exports = {
    acceptRentals,
    bookProperty,
    cancelBooking,
    createNewProperty,
    getOwnersProperties,
    getPropertyDetails,
    rejectBookings,
};
