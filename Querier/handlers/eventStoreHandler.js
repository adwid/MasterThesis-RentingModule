const esConnection = require('../eventStore').connection();
const db = require('./dbHandler');
const fw = require('./forwardHandler');

const streamName = "rental";

const eventCallback = {
    'accept':   {dbFunction: db.acceptRentals,      fwFunction: undefined},
    'book':     {dbFunction: db.bookProperty,       fwFunction: undefined},
    'cancel':   {dbFunction: db.cancelBooking,      fwFunction: undefined},
    'comment':  {dbFunction: db.addComment,         fwFunction: undefined},
    'create':   {dbFunction: db.createNewProperty,  fwFunction: fw.forwardToOwner},
    'delete':   {dbFunction: db.deleteProperty,     fwFunction: undefined},
    'message':  {dbFunction: db.storeMessage,       fwFunction: undefined},
    'reject':   {dbFunction: db.rejectBookings,     fwFunction: undefined},
    'update':   {dbFunction: db.updateProperty,     fwFunction: undefined},
};

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
    const activity = JSON.parse(event.originalEvent.data);
    if (!eventCallback.hasOwnProperty(eventType)) {
        console.error("[ERR] ES : unkown event's type : " + eventType);
        return;
    }
    var updateDB = eventCallback[eventType].dbFunction;
    var forwardInformation = eventCallback[eventType].fwFunction;
    updateDB(activity)
        .then(dbUpdateResult => {
            if (!dbUpdateResult) return Promise.resolve();
            console.log("Event \'" + eventType + "\': DB updated");
            if (!forwardInformation) return Promise.resolve();
            else return forwardInformation(eventType, activity.actor, dbUpdateResult);
        })
        .then(_ => console.log("Event \'" + eventType + "\' correctly processed."))
        .catch(err => console.error("[ERR] ES/onNewEvent : " + err));
}
