const chai = require('chai');
const chaiHTTP = require('chai-http');

chai.use(chaiHTTP);
chai.should();

const rentalOutbox = chai.request(process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_OUTBOX_PORT).keepOpen();
const rentalQuerier = chai.request(process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_QUERIER_PORT).keepOpen();
const rentalSecretary = process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_QUERIER_PORT + "/rental/secretary";

const actorsIDs = [];
const buffer = [];
const timeout = 100;
const slow = 1000;


module.exports = {
    actorsIDs,
    buffer,
    chai,
    rentalOutbox,
    rentalQuerier,
    rentalSecretary,
    slow,
    timeout,
}
