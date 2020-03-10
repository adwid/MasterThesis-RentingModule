var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var database = require('./database');

var indexRouter = require('./routes/index');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

database.open()
    .catch(() => {
        console.error('Please check that the MongoDB server is running.');
        process.exit(1);
    });

// initialize the event store subscription
require('./handlers/eventStoreHandler');

app.use('/', indexRouter);

module.exports = app;
