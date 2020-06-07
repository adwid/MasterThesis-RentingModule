var express = require('express');
var router = express.Router();
var esHandler = require('../handlers/eventStoreHandler');
const { v1: uuid } = require('uuid');

const routes = [
    "accept",
    "book",
    "cancel",
    "close",
    "comment",
    "create",
    "delete",
    "open",
    "reject",
    "update",
];

/* Post data to event store */
router.post('/secretary/:route', function(req, res, next) {
    if (!routes.includes(req.params.route)) {
        next();
        return;
    }
    let eventType = req.params.route;
    let activity = req.body;
    if (eventType === "create") {
        activity.object.content.owner = activity.actor;
    }
    postEvent(activity, eventType, res);
});

router.post('/news', function (req, res) {
    let activity = req.body;
    postEvent(activity, "news", res);
});

function postEvent(activity, eventType, res) {
    esHandler.postEvent(activity, eventType)
        .then(() => {
            res.status(201).end()
        })
        .catch(() => {
            res.status(500).json({
                error: "Internal error. Please try later or contact admins."
            });
        });
}

module.exports = router;
