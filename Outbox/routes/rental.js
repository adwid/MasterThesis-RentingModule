var express = require('express');
var router = express.Router();
const requestHandler = require('../handler/requestHandler');
const axios = require('axios');

const routes = {
    'accept':   {inboxRoute:    '/accept',  activityGenerator:  requestHandler.generateCreateAcceptActivity},
    'book':     {inboxRoute:    '/book',    activityGenerator:  requestHandler.generateCreateBookActivity},
    'cancel':   {inboxRoute:    '/cancel',  activityGenerator:  requestHandler.generateCreateCancelActivity},
    'comment':  {inboxRoute:    '/comment', activityGenerator:  requestHandler.generateCreateCommentActivity},
    'create':   {inboxRoute:    '/create',  activityGenerator:  requestHandler.generateCreateCreateActivity},
    'delete':   {inboxRoute:    '/delete',  activityGenerator:  requestHandler.generateCreateDeleteActivity},
    'reject':   {inboxRoute:    '/reject',  activityGenerator:  requestHandler.generateCreateAcceptActivity},
    'update':   {inboxRoute:    '/update',  activityGenerator:  requestHandler.generateCreateUpdateActivity},
};

router.post('/:route', function(req, res, next) {
    if (!routes.hasOwnProperty(req.params.route)) {
        next();
        return;
    }
    const currentRoute = routes[req.params.route];
    const activity = currentRoute.activityGenerator(req.body);
    if (!activity) {
        res.status(400).end();
        return;
    }
    axios.post('http://10.42.0.1:' + process.env.RENTAL_INBOX_PORT + '/rental/secretary' + currentRoute.inboxRoute, activity)
        .then(_ => res.status(201).end())
        .catch(err => {
            console.error("Error(s) while forwarding to secretary : " + err);
            res.status(500).json({error: "An internal occurred. Please try later or contact admins."})
        });
});

module.exports = router;
