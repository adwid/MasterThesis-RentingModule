var express = require('express');
var router = express.Router();

router.post('/', function(req, res, next) {
  // post something to an inbox
  res.end();
});

module.exports = router;
