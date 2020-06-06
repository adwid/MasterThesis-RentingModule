const esClient = require('../eventStore');
const db = require('./dbHandler');
const fw = require('./forwardHandler');

const streamName = "rental";
const esConnection = esClient.connection();

const eventCallback = {
    'accept':   {dbFunction: db.acceptRentals,      fwFunction: fw.forwardAcceptedAndObsolete},
    'book':     {dbFunction: db.bookProperty,       fwFunction: fw.forwardBooking},
    'cancel':   {dbFunction: db.cancelBooking,      fwFunction: fw.forwardToActor},
    'comment':  {dbFunction: db.addComment,         fwFunction: undefined},         // todo
    'create':   {dbFunction: db.createNewProperty,  fwFunction: fw.forwardToActor},
    'delete':   {dbFunction: db.deleteProperty,     fwFunction: fw.forwardDeletion}, // todo (see db handler)
    'news':     {dbFunction: db.storeNews,          fwFunction: undefined},         // todo (+test to rebook after reject the conflict)
    'reject':   {dbFunction: db.rejectBookings,     fwFunction: undefined},         // todo
    'update':   {dbFunction: db.updateProperty,     fwFunction: fw.forwardToActor},
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
        .catch(err => catcher(err, activity, eventType));
}

function catcher(err, activity, eventType) {
    if (err.name === "ValidationError") {
        const propertyID = activity.object.content.property;
        const errField = Object.keys(err.errors)[0];
        fw.forwardErrorMessage(activity.actor, propertyID, eventType, err.errors[errField].message);
        return;
    }
    if (err.name === "MongoError" && err.code === 11000) {
        const propertyID = activity.object.content.property;
        fw.forwardErrorMessage(activity.actor, propertyID, eventType, "Duplication:" + Object.keys(err.keyValue));
        return;
    }
    if (err.name === "MyNotFoundError") {
        const ID = activity.object.content.property
            || activity.object.content.booking;
        fw.forwardErrorMessage(activity.actor, ID, eventType, err.message);
        return;
    }
    console.log("[ERR] ES/onNewEvent : " + err);
}
