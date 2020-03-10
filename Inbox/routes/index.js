var express = require('express');
var router = express.Router();
var esHandler = require('../handlers/eventStoreHandler');

/* Post data to event store */
router.post('/', function(req, res, next) {
  //esHandler.postEvent(...);
  res.end();
});

module.exports = router;
