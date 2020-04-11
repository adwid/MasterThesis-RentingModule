const createActivityFields = ["@context", "type", "actor", "object", "to"];
const objectFields = ["@context", "type", "to", "attributedTo", "content", "mediaType"];
const rentalFields = ["name", "province", "city", "capacity", "price", "showers", "meadow",
    "local", "kitchen", "campfire", "description"];

function generateCreateRentalActivity(request) {
    const activity = generateCreateObjectActivity(request, objectFields, isValidRental);
    if (!activity) return undefined;
    return activity;
}

function generateCreateObjectActivity(request, objectFields, funIsValidContent) {
    let activity = undefined;
    if (!request) return undefined;
    if (request.type === 'Note' && isValidNote(request, objectFields, funIsValidContent)) {
        activity = rentalNoteToCreateActivity(request, funIsValidContent);
    }
    if (request.type === 'Create' && isValidCreateActivity(request, objectFields, funIsValidContent)) {
        activity = request;
    }
    if (!activity) return undefined;
    activity.published = (new Date()).toISOString();
    return activity;
}

function isValidCreateActivity(activity, objectFields, funIsValidContent) {
    if (!activity
        || !createActivityFields.every(field => activity.hasOwnProperty(field))
        || activity.type !== "Create"
        || !isValidNote(activity.object, objectFields, funIsValidContent)
    ) return false;
    return true;
}

function isValidNote(object, fields, funIsContentValid) {
    if (!object
        || !fields.every(field => object.hasOwnProperty(field))
        || object.type !== "Note"
        || object.mediaType !== "application/json"
        || (!!funIsContentValid && !funIsContentValid(object.content))
    ) return false;
    return true;
}

function isValidRental(content) {
    if (!content
        || !rentalFields.every(field => content.hasOwnProperty(field))
    ) return false;
    return true;
}

function rentalNoteToCreateActivity(note) {
    return {
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "Create",
        "actor": note.attributedTo,
        "to": note.to,
        "object": note
    };
}

module.exports = {
    generateCreateRentalActivity,
};
