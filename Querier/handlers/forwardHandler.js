const { v1: uuid } = require('uuid');
const axios = require('axios');
const actorHandler = require('./actorHandler');
const db = require('./dbHandler');

function forwardErrorMessage(actor, rideID, type, message) {
    send(actor, {
        "url": rideID,
        "type": "error",
        "error": type + ":::" + message,
    }).then(_ => {
        console.log("Event \'" + type + "\': user's error detected and handled");
    });
}

function forwardToOwner(type, from, dbObject) {
    return send(dbObject.owner, {"url": dbObject._id, "type": type});
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
    forwardErrorMessage,
    forwardToOwner,
};
