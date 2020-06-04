var express = require('express');
var router = express.Router();
const db = require('../handlers/dbHandler');
const axios = require('axios');

router.get("/new/:uid", (req, res) => {
    processRequest(db.getNewNews, req.params.uid, res);
});

router.get("/old/:uid", (req, res) => {
    processRequest(db.getOldNews, req.params.uid, res);
});

function processRequest(dbFunction, uid, response) {
    dbFunction(uid)
        .then(news => {
            if (news.length === 0) {
                response.status(204).end();
                // interrupt the then-chain:
                return Promise.reject('NoNews');
            }
            const promises = [];
            for (const n of news) {
                const promise = axios.get(n.message)
                    .then(response => { return Promise.resolve(response.data) })
                    .catch(err => {
                        console.error("[ERR] Get a message : " + err);
                        return Promise.resolve(undefined);
                    })
                promises.push(promise);
            }
            return Promise.all(promises);
        })
        .then(messages => {
            response.json(messages.filter(msg => msg !== undefined));
        })
        .catch((err) => {
            if (err === "NoNews") return; // used to interrupt the then-chain
            console.error("[ERR] GET NEWS : " + err);
            response.status(500).json({error: "Internal error. Please try later or contact admins"});
        });
}

module.exports = router;
