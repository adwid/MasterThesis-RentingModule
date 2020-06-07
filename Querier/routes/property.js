var express = require('express');
var router = express.Router();
const db = require('../handlers/dbHandler');

router.get("/search", function (req, res) {
    db.searchProperty(req.query)
        .then(properties => {
            res.send(properties);
        })
        .catch(err => {
            if (err.hasOwnProperty("name") && err.name === 'CastError') {
                res.status(400).end();
                return;
            }
            console.error(err);
            res.status(500).end();
        });
});

router.get("/details", function (req, res) {
    if (!req.query.hasOwnProperty("id")) return res.status(400).end();
    db.getPropertyDetails(req.query.id)
        .then(property => {
            res.send(property);
        })
        .catch(err => {
            console.error("" + err);
            res.status(500).end();
        });
});

router.get('/my/:id', function(req, res, next) {
    db.getOwnersProperties(req.params.id)
        .then(properties => {
            res.send(properties);
        })
        .catch(err => {
            console.error("" + err);
            res.status(500).end();
        });
});

router.get("/:id", function (req, res) {
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    db.getPropertyByID(fullUrl)
        .then(ride => {
            res.json(ride);
        })
        .catch(err => {
            console.error("" + err);
            res.status(500).end();
        });
});

module.exports = router;
