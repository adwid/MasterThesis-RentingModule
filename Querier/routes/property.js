var express = require('express');
var router = express.Router();
const db = require('../handlers/dbHandler');

router.get("/details", function (req, res) {
    if (!req.query.property) {
        res.status(400).end();
        return;
    }
    db.getPropertyDetails(req.query.owner, req.query.property)
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

module.exports = router;
