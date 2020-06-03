var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const database = require('./database');

var rentalRouter = require('./routes/rental');

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

app.use('/rental', rentalRouter);

module.exports = app;
