var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  // for example, you can use the dbHandler to get something in database
  res.end();
});

module.exports = router;
