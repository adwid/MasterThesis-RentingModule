const PropertyModel = require('../models/property');
const RentalModel = require('../models/rental');
const CommentModel = require('../models/comment');
const NewsModel = require('../models/news');
const MessageModel = require('../models/message');
const { v1: uuid } = require('uuid');

function acceptRentals(activity) {
    const noteObject = activity.object;
    const ownerID = noteObject.attributedTo;
    const propertyID = noteObject.content.property;
    let acceptedIDs = noteObject.content.bookings;
    let findRequest = {
        _id: propertyID,
        owner: ownerID
    };

    return PropertyModel
        .findOne(findRequest)
        .populate('waitingList')
        .then(property => {
            if (!property) return Promise.reject({name:"MyNotFoundError", message:"The property does not exist or you do not have the permission"});
            const acceptedBookings      = [];
            const acceptedBookingsIDs   = [];
            const obsoleteBookings      = [];
            const obsoleteBookingsIDs   = [];

            for (const booking of property.waitingList) {
                if (acceptedIDs.includes(booking._id)) {
                    acceptedBookings.push(booking);
                    acceptedBookingsIDs.push(booking._id);
                }
                else if (isBookingObsolete(booking, acceptedIDs, property.waitingList)) {
                    obsoleteBookings.push(booking);
                    obsoleteBookingsIDs.push(booking._id);
                }
            }

            if (acceptedBookingsIDs.length === 0) return Promise.reject({name:"MyNotFoundError", message:"None of the accepted rentals exist"});

            const updateRequest = {
                $addToSet: { rentals: { $each: acceptedBookingsIDs } },
                $pull: { waitingList: {$in: [...acceptedBookingsIDs, ...obsoleteBookingsIDs]} }
            };

            return Promise.all([
                PropertyModel.findOneAndUpdate(findRequest, updateRequest), // 0
                acceptedBookings,       // 1
                acceptedBookingsIDs,    // 2
                obsoleteBookings,       // 3
                obsoleteBookingsIDs,    // 4
            ])
        })
        .then( promisesResult => {
            return Promise.all([
                RentalModel.updateMany({ _id: {$in: promisesResult[2]} }, { $set: {accepted: true} }),  // 0
                RentalModel.updateMany({ _id: {$in: promisesResult[4]} }, { $set: {accepted: false} }), // 1
                promisesResult[1],  // 2, accepted
                promisesResult[3],  // 3, obsolete
                propertyID,         // 4
            ]);
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

    return RentalModel.findOne({ // find rentals...
        concern: noteObject.content.property,   // ...that concern the correct property...
        by: noteObject.attributedTo,            // ...booked by the comment's user...
        to: {$lt: (new Date()).toISOString()}   // ...and that are done
    })
        .then(rental => {
            if (!rental) return Promise.reject({name:"MyNotFoundError", message:"The property does not exist, you never booked this property, " +
                    "or the rental is not done."})
            return PropertyModel.findOne({ // check if property exists
                _id: noteObject.content.property,
                rentals: rental._id,
            })
        })
        .then(property => {
            if (!property) return Promise.reject({name:"MyNotFoundError", message:"The property does not exist."});
            return comment.save(); // save the comment
        })
        .then(_ => {
            return PropertyModel.findOneAndUpdate({ // add comment to property
                _id: noteObject.content.property
            }, {
                $push: {comments: comment._id}
            })
        })
}

function bookProperty(activity) {
    const noteObject = activity.object;
    const content = noteObject.content;

    return PropertyModel.findById(content.property).populate('rentals')
        .then(property => {
            if (!property) return Promise.reject({name:"MyNotFoundError", message:"The property does not exist"});

            content.from = resetTime(content.from);
            content.to = resetTime(content.to);
            var index = searchIndexOfPreviousRental(property.rentals, content.from, content.to);
            if (index === -2) return Promise.reject({name:"MyNotFoundError", message:"Your booking is in conflict with an accepted one"});

            const rental = new RentalModel({
                _id: process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_QUERIER_PORT + "/rental/specific/" + uuid(),
                concern: content.property,
                from: content.from,
                to: content.to,
                by: noteObject.attributedTo,
                made: (new Date()).toISOString(),
            });

            return Promise.all([
                rental.save(),  // 0
                property,       // 1
            ])
        })
        .then(promisesResult => {
            return PropertyModel.findOneAndUpdate({
                _id: content.property
            }, {
                $addToSet: {
                    waitingList: promisesResult[0]._id
                }
            }).then(_ => {
                return {
                    _id: promisesResult[0]._id,
                    owner: promisesResult[1].owner,
                }
            });
        })
}

function cancelBooking(activity) {
    const noteObject = activity.object;
    const bookingID = noteObject.content.booking;
    const userID = noteObject.attributedTo;

    return RentalModel.findOneAndRemove({
        _id: bookingID,
        by: userID,
        accepted: {$ne: true},
    }).then(rental => {
        if (!rental) return Promise.reject({name:"MyNotFoundError", message:"No rental found, rental already accepted," +
                " or you don't have the permission"});
        PropertyModel.findOneAndUpdate({
            _id: rental.concern
        }, {
            $pull: {
                waitingList: bookingID,
            }
        }).exec();
        return {_id: rental.concern};
    })
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

function getActivity(id) {
    return MessageModel.findOne({
        $or: [
            {id: id},
            {"object.id": id}
        ]
    }, "-_id -__v")
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
            promises.push(newsItem.updateOne({
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
    }, "-rentals -waitingList -comments -__v");
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

function getPropertyDetails(property) {
    return PropertyModel.findOne({
        _id: property
    }, "-__v")
        .then(property => {
            if (!property) return property;
            return property.populate('rentals', '-__v')
                .populate('waitingList', '-__v')
                .populate('comments', '-__v')
                .execPopulate()
        });
}

function getSpecificUserRental(rid) {
    return RentalModel.findOne({
        _id: rid,
    }, '-__v').populate('concern', '-__v -waitingList -rentals -comments')
        .then(rental => {
            return Promise.resolve(rental);
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
    }).then(property => {
        if (!property) return Promise.reject({name:"MyNotFoundError", message:"The property does not exist or you do not have the permission"});
        // filter IDs that actually were not part of the waitingList/rentals
        const correctlyRejected = rejectedBookingsIDs.filter(item => property.waitingList.includes(item) || property.rentals.includes(item));
        return RentalModel.find({
            _id: {$in: correctlyRejected}
        }).then(rentals => {
            if (rentals.length === 0) return Promise.reject({name: "MyNotFoundError", message: "No bookings found."});
            const promises = rentals.map(r => {return r.update({$set: {accepted: false}})});
            return Promise.all(promises)
                .then(_ => {
                    return {
                        owner: ownerID,
                        property: propertyID,
                        rentals: rentals,
                    };
                })
        })
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

function storeActivity(activity) {
    const message = new MessageModel(activity);
    message._id = activity.id
    return message.save();
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
    }, {
        runValidators: true,
    }).then(doc => {
        if (!doc) return Promise.reject({name:"MyNotFoundError", message:"No property found, or you don't have the permission"});
        return Promise.resolve(doc);
    });
}

/*-------------------------------------------------------------*/
/* PRIVATE FUNCTIONS */
/*-------------------------------------------------------------*/

function isBookingObsolete(suspiciousBooking, acceptedBookingsIDs, allBookings) {
    for (const booking of allBookings) {
        if(!acceptedBookingsIDs.includes(booking._id)) continue;
        if (suspiciousBooking.from < (new Date()).toISOString()) return true;
        // Negation of next condition (thanks to De Morgan Theorem)
        // if ((suspiciousBooking.from < booking.from && suspiciousBooking.to <= booking.from)
        //     || (suspiciousBooking.from >= booking.to && suspiciousBooking.to > booking.to))
        if ((suspiciousBooking.from >= booking.from || suspiciousBooking.to > booking.from)
            && (suspiciousBooking.from < booking.to || suspiciousBooking.to <= booking.to)) {
            return true;
        }
    }

    return false;
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
    getActivity,
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
    storeActivity,
    storeNews,
    updateProperty,
};
