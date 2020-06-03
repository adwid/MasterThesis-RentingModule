const PropertyModel = require('../models/property');
const RentalModel = require('../models/rental');
const CommentModel = require('../models/comment');
const NewsModel = require('../models/news');
const { v1: uuid } = require('uuid');

function acceptRentals(activity) {
    const noteObject = activity.object;
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

            deleteSome(RentalModel, obsoleteBookingsIDs); // todo inform bookers !
            return PropertyModel.findOneAndUpdate(findRequest, updateRequest);
        })
        .then(_ => {
            return RentalModel.updateMany({
                _id: {$in: acceptedBookingsIDs}
            }, {
                $set: {accepted: true}
            })
        });
}

function addComment(activity) {
    const noteObject = activity.object;
    const comment = new CommentModel({
        content: noteObject.content.comment,
        by: noteObject.attributedTo,
        date: (new Date()).toISOString(),
        concern: noteObject.content.property
    });

    return RentalModel.find({ // find rentals...
        concern: noteObject.content.property,   // ...that concern the correct property...
        by: noteObject.attributedTo,            // ...booked by the comment's user...
        to: {$lt: (new Date()).toISOString()}   // ...and that are done
    })
        .then(rentals => {
            if (rentals.length === 0) {
                return Promise.reject({requestErr: "You never booked this property" +
                        " or the rental is not done."})
            }
            const rentalsIDs = [];
            for (const rental of rentals)
                rentalsIDs.push(rental._id);
            return PropertyModel.findOne({ // check if property exists
                _id: noteObject.content.property,
                rentals: {$elemMatch: {$in: rentalsIDs}}
            })
        })
        .then(property => {
            if (!property) {
                return Promise.reject({
                    requestErr: "The property does not exist, " +
                        "or you never rented this property"
                });
            }
            return comment.save(); // save the comment
        })
        .then(_ => {
            return PropertyModel.findOneAndUpdate({ // add comment to property
                _id: noteObject.content.property
            }, {
                $push: {comments: comment._id}
            })
        })
        .catch(err => {
            if (!!err && !!err.requestErr) {
                console.log("Error with the request: " + err.requestErr);
                // todo inform the request's user
                return Promise.resolve();
            }
            return Promise.reject(err);
        });
}

function bookProperty(activity) {
    const noteObject = activity.object;
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

function cancelBooking(activity) {
    const noteObject = activity.object;
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
            return deleteSome(RentalModel, [bookingID]);
        });
}

function createNewProperty(activity) {
    const noteObject = activity.object;
    var content = noteObject.content;
    content._id = process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_QUERIER_PORT + "/rental/property/" + uuid();
    const newProperty = new PropertyModel(content);
    return newProperty.save();
}

function deleteProperty(activity) {
    const noteObject = activity.object;
    const owner = noteObject.attributedTo;
    const pid = noteObject.content.property;
    return PropertyModel.findOneAndRemove({
        _id: pid,
        owner: owner
    }).then(doc => {
        if (!doc) return Promise.reject({name:"MyNotFoundError", message:"No property found, or you don't have the permission"});
        deleteSome(RentalModel, doc.waitingList);
        deleteSome(RentalModel, doc.rentals); // todo inform
        deleteSome(CommentModel, doc.comments);
        return Promise.resolve(doc);
    });
}

function getAllUserRentals(uid) {
    return RentalModel.find({
        by: uid
    }).populate('concern')
        .then(rentals => {
            const result = [];
            for (const rental of rentals) {
                result.push(cleanRental(rental));
            }
            return Promise.resolve(result);
        });
}

function getNewNews(uid) {
    return NewsModel.find({
        to: uid,
        seen: false
    }).then(news => {
        const promises = [];
        for (const newsItem of news) {
            promises.push(newsItem.update({
                $set: {seen: true}
            }).catch(err => {
                console.error("[ERR] db update : " + err)
            }));
        }
        promises.push(Promise.resolve(news)); // keep news for next step
        return Promise.all(promises);
    }).then(resolvedPromises => {
        const jsonNews = [];
        if (resolvedPromises.length === 0) return Promise.resolve(jsonNews);
        const news = resolvedPromises[resolvedPromises.length - 1];
        for (const n of news) jsonNews.push(n.toJSON());
        return Promise.resolve(jsonNews);
    });
}

function getPropertyByID(id) {
    return PropertyModel.findOne({
        _id: id
    });
}

function getOldNews(uid) {
    return NewsModel.find({
        to: uid,
        seen: true
    });
}

function getOwnersProperties(owner) {
    return PropertyModel.find({owner: owner});
}

function getPropertyDetails(owner, property) {
    return PropertyModel.findOne({
        _id: property
    })
        .populate('rentals')
        .populate('waitingList')
        .populate('comments')
        .then(property => {
            if (!property || property.owner === owner) {
                return Promise.resolve(property);
            }
            property = property.toObject();
            for (const index in property.waitingList) {
                delete property.waitingList[index]['_id'];
                delete property.waitingList[index]['by'];
            }
            for (const index in property.rentals) {
                delete property.rentals[index]['_id'];
                delete property.rentals[index]['by'];
            }
            return Promise.resolve(property);
        });
}

function getSpecificUserRental(uid, rid) {
    return RentalModel.findOne({
        _id: rid,
        by: uid
    }).populate('concern')
        .then(rental => {
            return Promise.resolve(cleanRental(rental));
        });
}

function rejectBookings(activity) {
    const noteObject = activity.object;
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
        deleteSome(RentalModel, correctlyRejected);
        return Promise.resolve("ok");
    });
}

function searchProperty(query) {
    let request = {};
    if (query.hasOwnProperty("capmin")) request.capacity = {"$gte": query.capmin};
    if (query.hasOwnProperty("capmax"))
        request.capacity = {"$lte": query.capmax, ...request.capacity};
    if (query.hasOwnProperty("primin")) request.price = {"$gte": query.primin};
    if (query.hasOwnProperty("primax"))
        request.price = {"$lte": query.primax, ...request.price};
    if (query.hasOwnProperty("shomin")) request.showers = {"$gte": query.shomin};
    if (query.hasOwnProperty("name")) request.name = {"$eq": query.name};
    if (query.hasOwnProperty("province")) request.province = {"$eq": query.province};
    if (query.hasOwnProperty("city")) request.city = {"$eq": query.city};
    if (query.hasOwnProperty("meadow")) request.meadow = {"$eq": true};
    if (query.hasOwnProperty("local")) request.local = {"$eq": true};
    if (query.hasOwnProperty("kitchen")) request.kitchen = {"$eq": true};
    if (query.hasOwnProperty("campfire")) request.campfire = {"$eq": true};
    return PropertyModel.find(request)
        .then(properties => {
            if (query.hasOwnProperty("avafrom") && query.hasOwnProperty("avato")) {
                var from = resetTime(query.avafrom);
                var to = resetTime(query.avato);
                return removeUnavailableProperties(properties, from, to);
            }
            return Promise.resolve(properties);
        });
}

function storeNews(activity) {
    const promises = [];
    const to = Array.isArray(activity.to) ? activity.to : [activity.to];
    for (const actor of to) {
        let url = new URL(actor);
        // only store news for users in the same domain than the current instance :
        if (url.hostname === process.env.HOST)
            promises.push(storeNewsAux(activity, actor));
    }
    return Promise.all(promises);
}

function updateProperty(activity) {
    const noteObject = activity.object;
    const fields = ["name", "capacity", "price", "showers", "meadow", "local", "kitchen",
        "campfire", "description"];
    const pid = noteObject.content.property;
    const owner = noteObject.attributedTo;
    let setters = {};
    fields.forEach(field => {
        if (noteObject.content.hasOwnProperty(field)) {
            setters[field] = noteObject.content[field]
        }
    });
    if (isEmpty(setters)) return Promise.resolve();
    return PropertyModel.findOneAndUpdate({
        _id: pid,
        owner: owner
    }, {
        $set: setters
    }) // todo catch error if user input does not respect property model ?
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

function deleteSome(Model, ids) { // todo check for each usage if it needs to inform concerned users
    if (!Array.isArray(ids) || ids.length === 0) return;
    return Model.deleteMany({
        _id: {$in: ids}
    }).catch(err => {
        console.error("Err while trying to delete some " + Model.modelName + " : " + err);
        return Promise.reject(err);
    });
}

function isEmpty(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object
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

function cleanRental(rental) {
    if (!rental) return rental;
    let tmp = rental.toObject();
    delete tmp.concern["waitingList"];
    delete tmp.concern["rentals"];
    delete tmp.concern["comments"];
    return tmp;
}

function removeUnavailableProperties(properties, from, to) {
    const promises = [];
    for (const property of properties) {
        let promise = property.populate("rentals").execPopulate()
            .then(property => {
                if (searchIndexOfPreviousRental(property.rentals, from, to) === -2) {
                    return Promise.resolve();
                }
                return Promise.resolve(property.depopulate('rentals'));
            });
        promises.push(promise)
    }
    return Promise.all(promises)
        .then(props => {
            return Promise.resolve(props.filter(p => p !== undefined))
        });
}

function resetTime(dateISOString) {
    var part = dateISOString.split("T");
    return part[0] + "T00:00:00.000Z"
}

function storeNewsAux(activity, recipient) {
    const newNews = new NewsModel({
        message: activity.id,
        to: recipient
    });
    return newNews.save()
        .catch(err => {
            console.error("[ERR] not able to store a news in DB : " + err);
        });
}

module.exports = {
    acceptRentals,
    addComment,
    bookProperty,
    cancelBooking,
    createNewProperty,
    getAllUserRentals,
    getNewNews,
    getOldNews,
    getOwnersProperties,
    getPropertyByID,
    getPropertyDetails,
    getSpecificUserRental,
    deleteProperty,
    rejectBookings,
    searchProperty,
    storeNews,
    updateProperty,
};
