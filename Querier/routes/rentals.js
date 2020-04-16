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

module.exports = router;
