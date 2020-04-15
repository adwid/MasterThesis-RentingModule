const createActivityFields = ["@context", "type", "actor", "object", "to"];
const objectFields = ["@context", "type", "to", "attributedTo", "content", "mediaType"];
const rentalFields = ["name", "province", "city", "capacity", "price", "showers", "meadow",
    "local", "kitchen", "campfire", "description"];
const bookFields = ["property", "from", "to"];
const manageFields = ["property", "bookings"];
const cancelFields = ["booking"];
const commentFields = ["comment","property"];
const commentLengthMax = 300;

function generateCreateAcceptActivity(request) {
    const activity = generateCreateObjectActivity(request, objectFields, isValidManage);
    if (!activity) return undefined;
    return activity;
}

function generateCreateRentalActivity(request) {
    const activity = generateCreateObjectActivity(request, objectFields, isValidRental);
    if (!activity) return undefined;
    return activity;
}

function generateCreateBookActivity(request) {
    const activity = generateCreateObjectActivity(request, objectFields, isValidBook);
    if (!activity) return undefined;
    return activity;
}

function generateCreateCancelActivity(request) {
    const activity = generateCreateObjectActivity(request, objectFields, isValidCancel);
    if (!activity) return undefined;
    return activity;
}

function generateCreateCommentActivity(request) {
    const activity = generateCreateObjectActivity(request, objectFields, isValidComment);
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

function isValidBook(content) {
    if (!content
        || !bookFields.every(field => content.hasOwnProperty(field))
        || !isIsoDate(content.from)
        || content.duration <= 0
        || (new Date(content.from)).getTime() <= Date.now()
        || content.to < content.from
    ) return false;
    return true;
}

function isValidCancel(content) {
    if (!content
        || !cancelFields.every(field => content.hasOwnProperty(field)))
        return false;
    return true;
}

function isValidManage(content) {
    if (!content
        || !manageFields.every(field => content.hasOwnProperty(field)))
        return false;
    return true;
}

function isValidComment(content) {
    if (!content
        || !commentFields.every(field => content.hasOwnProperty(field))
        || content.comment.length > commentLengthMax)
        return false;
    return true;
}

function isIsoDate(str) {
    if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(str)) return false;
    var d = new Date(str);
    return d.toISOString()===str;
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
    generateCreateAcceptActivity,
    generateCreateRentalActivity,
    generateCreateBookActivity,
    generateCreateCancelActivity,
    generateCreateCommentActivity,
};
