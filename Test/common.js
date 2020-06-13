const chai = require('chai');
const chaiHTTP = require('chai-http');

chai.use(chaiHTTP);
chai.should();

const agendaOutbox = chai.request(process.env.PREFIX + process.env.HOST + ":" + process.env.AGENDA_OUTBOX_PORT).keepOpen();
const agendaQuerier = chai.request(process.env.PREFIX + process.env.HOST + ":" + process.env.AGENDA_QUERIER_PORT).keepOpen();
const agendaSecretary = process.env.PREFIX + process.env.HOST + ":" + process.env.AGENDA_QUERIER_PORT + "/agenda/secretary";

const carpooOutbox = chai.request(process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_OUTBOX_PORT).keepOpen();
const carpooQuerier = chai.request(process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_QUERIER_PORT).keepOpen();
const carpooSecretary = process.env.PREFIX + process.env.HOST + ":" + process.env.CARPOOLING_QUERIER_PORT + "/carpooling/secretary";

const rentalOutbox = chai.request(process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_OUTBOX_PORT).keepOpen();
const rentalQuerier = chai.request(process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_QUERIER_PORT).keepOpen();
const rentalSecretary = process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_QUERIER_PORT + "/rental/secretary";

const actorsIDs = [];
const buffer = [];
const timeout = 100 ;


module.exports = {
    actorsIDs,
    agendaOutbox,
    agendaQuerier,
    agendaSecretary,
    buffer,
    carpooOutbox,
    carpooQuerier,
    carpooSecretary,
    chai,
    rentalOutbox,
    rentalQuerier,
    rentalSecretary,
    timeout,
}
