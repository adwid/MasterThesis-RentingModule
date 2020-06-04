var express = require('express');
var router = express.Router();
const db = require('../handlers/dbHandler');

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
        "id": process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_QUERIER_PORT + "/rental/secretary",
        "type": "Application",
        "name": "Rental module secretary",
        "summary": "In charge of processing all messages concerning the rental module (domain " +
            process.env.PREFIX + process.env.HOST + ")",
        "inbox": process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_INBOX_PORT + "/rental/secretary",
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

router.get("/message/:id", (req, res) => {
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    db.getActivity(fullUrl)
        .then(activity => {
            if (!activity) return res.status(204).end();
            res.json(activity);
        })
        .catch(err => {
            console.error("[ERR] get activity: " + err);
            res.status(500).json({error: "An internal occurred. Please try later or contact admins."})
        });
});

module.exports = router;
