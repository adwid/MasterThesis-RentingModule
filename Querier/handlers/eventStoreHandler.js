const esConnection = require('../eventStore').connection();
const db = require('./dbHandler');

const streamName = "rental";

esConnection.subscribeToStream(streamName, false, onNewEvent)
    .then(_ => {
        console.log("Subscription confirmed (stream %s)", streamName);
    })
    .catch(err => {
        console.error("[ERR] error with stream subscription (stream %s) : %s", streamName, err);
        process.exit(1);
    });

function onNewEvent(sub, event) {
    const eventType = event.originalEvent.eventType;
    const eventContent = JSON.parse(event.originalEvent.data);
    // For example, you can then store something in the database :
    // db.createNew()
    //     .then(_ => console.log("Event " + eventType + " stored !"))
    //     .catch(err => console.error("[ERR] database : " + err));
}
