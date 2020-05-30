var express = require('express');
var router = express.Router();
const db = require('../handlers/dbHandler');
const es = require('../handlers/eventStoreHandler');

router.get("/all", function (req, res) {
    if (!req.query.uid) {
        res.status(400).end();
        return;
    }
    db.getAllUserRentals(req.query.uid)
        .then(rentals => {
            res.send(rentals);
        })
        .catch(err => {
            console.error("" + err);
            res.status(500).end();
        });

});

router.get("/secretary", (req, res) => {
    res.json({
        "@context": "http://www.w3.org/ns/activitystreams",
        "type": "Application",
        "name": "Rental module secretariat",
        "summary": "In charge of processing all messages concerning the rental module (domain " +
            process.env.PREFIX + process.env.HOST + ")"
    })
});

router.get("/specific", function (req, res) {
    if (!req.query.uid || !req.query.rid) {
        res.status(400).end();
        return;
    }
    db.getSpecificUserRental(req.query.uid, req.query.rid)
        .then(rental => {
            res.send(rental);
        })
        .catch(err => {
            console.error("" + err);
            res.status(500).end();
        });
});

router.get("/:id", (req, res) => {
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    es.getSpecificObjects([fullUrl])
        .then(esResponse => {
            const list = esResponse.list;
            if (!list || list.length === 0) res.status(204).end();
            else if (list.length === 1) res.json(list[0]);
            else return Promise.reject("The projection counted more than one event for the ID : " + fullUrl);
        })
        .catch(err => {
            console.error("[ERR] ES projection : " + err);
            res.status(500).json({error: "Internal error. Please try later or contact admins"});
        });
});

module.exports = router;
