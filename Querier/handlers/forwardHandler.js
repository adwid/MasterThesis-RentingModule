const { v1: uuid } = require('uuid');
const axios = require('axios');
const actorHandler = require('./actorHandler');
const db = require('./dbHandler');

function forwardErrorMessage(actor, id, type, message) {
    send(actor, {
        "url": id,
        "type": "error",
        "error": type + ":::" + message,
    }).then(_ => {
        console.log("Event \'" + type + "\': user's error detected and handled");
    });
}

function forwardAcceptedAndObsolete(type, from, dbObject) {
    const promises = [];
    const acceptedBookings = dbObject[2];
    const obsoleteBookings = dbObject[3];
    const propertyID = dbObject[4];
    promises.push(send(from, {"url": propertyID, "from": from, "type": type}))
    for (const booking of acceptedBookings) promises.push(
        send(booking.by, {"url": booking._id, "from": from, "type": type})
    )
    for (const booking of obsoleteBookings) promises.push(
        send(booking.by, {"url": booking._id, "from": from, "type": "reject"})
    )
    return Promise.all(promises);
}

function forwardDeletion(type, from, dbObject) {
    return sendMany([from, ...dbObject.bookers], {"url": dbObject._id, "from": from, "details": dbObject.details, "type": type});
}

function forwardReject(type, from, dbObject) {
    const promises = dbObject.rentals.map(r => {
        return send(r.by, {"url": r._id, "from": from, "type": type});
    })
    return Promise.all([
        send(dbObject.owner, {"url": dbObject.property, "from": from, "type": type}),
        ...promises,
    ])
}

function forwardToActor(type, from, dbObject) {
    return send(from, {"url": dbObject._id, "from": from, "type": type});
}

function forwardToBoth(type, from, dbObject) {
    return sendMany([dbObject.owner, from], {"url": dbObject._id, "from": from, "type": type})
}

function send(actor, content) {
    const activity = objectToActivity(actor, content);
    return actorHandler.getInboxAddresses(actor)
        .then(addr => {
            if (addr.length === 0) return Promise.reject("(send) no inbox addr found.");
            return db.storeActivity(activity).then(_ => { return addr[0] });
        })
        .then(addr => {
            return axios.post(addr, activity)
        })
        .catch(err => {
            console.error("[ERR] unable to send message (" + actor + ") : " + err)
            return Promise.resolve();
        });
}

function sendMany(actors, content) {
    const promises = [];
    for (const actor of actors)
        promises.push(send(actor, content));
    return Promise.all(promises);
}

function objectToActivity(to, content) {
    const secretary = process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_QUERIER_PORT + '/rental/secretary';
    return {
        "@context": "https://www.w3.org/ns/activitystreams",
        "id": process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_QUERIER_PORT + "/rental/message/" + uuid(),
        "type": "Create",
        "to": to,
        "actor": secretary,
        "published": (new Date()).toISOString(),
        "object": {
            "@context": "https://www.w3.org/ns/activitystreams",
            "id": process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_QUERIER_PORT + "/rental/message" + uuid(),
            "type": "Note",
            "mediaType": "application/json",
            "attributedTo": secretary,
            "to": to,
            "content": content,
        }
    }
}

module.exports = {
    forwardAcceptedAndObsolete,
    forwardDeletion,
    forwardErrorMessage,
    forwardReject,
    forwardToActor,
    forwardToBoth,
};
