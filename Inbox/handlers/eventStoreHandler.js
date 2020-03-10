const eventStore = require('node-eventstore-client');
const esConnection = require('../eventStore').connection();
const hashObject = require('object-hash');
const uuidFromString = require('uuid-by-string');

const streamName = "STREAM_NAME";

function postEvent(content, type) {
    const hash = hashObject(content);
    const event = eventStore.createJsonEventData(uuidFromString(hash), content, undefined, type);
    return esConnection.appendToStream(streamName, eventStore.expectedVersion.any, event)
        .then(() => {
            console.log("Stored event of type " + type);
            return Promise.resolve()
        })
        .catch((err) => {
            console.log("An error occurred while writing event (type : " + type + ") : " + err);
            return Promise.reject();
        });
}

module.exports = {postEvent};

