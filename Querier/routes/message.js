var express = require('express');
var router = express.Router();
const db = require('../handlers/dbHandler');
const esHandler = require('../handlers/eventStoreHandler');

router.get("/new/:uid", (req, res) => {
    processRequest(db.getNewMessages, req.params.uid, res);
});

router.get("/old/:uid", (req, res) => {
    processRequest(db.getOldMessages, req.params.uid, res);
});

function processRequest(dbFunction, uid, response) {
    dbFunction(uid)
        .then(messages => {
            if (messages.length === 0) {
                response.status(204).end();
                // interrupt the then-chain:
                return Promise.reject('NoMessage');
            }
            const ids = [];
            for (const m of messages) ids.push(m.url);
            return esHandler.getSpecificObjects(ids);
        })
        .then(esResult => {
            response.json(esResult.list);
        })
        .catch((err) => {
            if (err === "NoMessage") return; // used to interrupt the then-chain
            console.error("[ERR] GET MESSAGES : " + err);
            response.status(500).json({error: "Internal error. Please try later or contact admins"});
        });
}

module.exports = router;
