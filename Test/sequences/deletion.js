const common = require("../common");
const chai = common.chai;
const activityHelper = require('../helpers/activityHelper');
const db = require('../helpers/dbHelper');
const clone = require('clone');

const actors = common.actorsIDs;
const rentalSecretary = common.rentalSecretary;

describe("[Rental] Validations", function () {
    let propertyID;
    let propertyInDetailsURL;
    const newProperty = {
        "name": "RAEC Mons",
        "province": "Hainaut",
        "city": "Mons",
        "capacity": 50,
        "price": 100,
        "showers": 5,
        "meadow": true,
        "local": true,
        "kitchen": true,
        "campfire": false,
        "description": "Near to a Colruyt (3km)"
    };
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() + 1);
    const endDate = new Date(startDate.getTime())
    endDate.setDate(endDate.getDate() + 10);

    before(function (done) {
        db.cleanRentalQuerierDB().then(_ => done())
            .catch(err => {
                throw err
            });
    })
    this.slow(common.slow);
    beforeEach(done => setTimeout(done, common.timeout));

    describe("actor[0] creates a new property", function () {
        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/create", actors[0], rentalSecretary, newProperty);

        activityHelper.shouldReceiveActivity("actor00", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[0]), rentalSecretary);

        it('should be a creation notification', function () {
            common.buffer.should.have.lengthOf(1);
            const msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url");
            propertyID = msg.url;
            propertyInDetailsURL = process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_QUERIER_PORT
                + "/rental/property/details?id=" + encodeURIComponent(propertyID);
            msg.should.have.property("from", actors[0]);
            msg.should.have.property("type", "create");
        });

    });

    describe("actor[1,2] books the property on different dates", function () {
        const body01 = {};
        const body02 = {};

        it('(should crate message body)', function () {
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() + 1);
            const endDate = new Date(startDate.getTime())
            endDate.setDate(endDate.getDate() + 10);
            body01.property = propertyID;
            body01.from = startDate.toISOString();
            body01.to = endDate.toISOString();
            startDate.setFullYear(startDate.getFullYear() + 1);
            endDate.setFullYear(endDate.getFullYear() + 1);
            body02.property = propertyID;
            body02.from = startDate.toISOString();
            body02.to = endDate.toISOString();
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/book", actors[1], rentalSecretary, body01);
        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/book", actors[2], rentalSecretary, body02);

        for(const index of [0,1,2])
            activityHelper.shouldReceiveActivity("actor0" + index, common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[index]), rentalSecretary);

        it('should be all \'book\' notifications', function () {
            common.buffer.should.have.lengthOf(4);
            // the three first are the messages of each actor (3 2 and 1)
            // the last three are the messages received by actor0
            // (remember that common.buffer acts as a stack)
            let msg;
            for (const index of [2, 1, 2, 1]) {
                msg = common.buffer.pop();
                msg.should.be.an("object");
                msg.should.have.property("url");
                msg.should.have.property("from", actors[index]);
                msg.should.have.property("type", "book");
            }
            common.buffer.push(msg.url); // actor1's booking ID
        });

    });

    describe('actor0 accepts actor1\'s booking', function () {
        const body = {};

        it('(should create message body)', function () {
            common.buffer.should.have.lengthOf(1);
            body.property = propertyID;
            body.bookings = [common.buffer.pop()];
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/accept", actors[0], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor00", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[0]), rentalSecretary);
        activityHelper.shouldReceiveActivity("actor01", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[1]), rentalSecretary);

        it('should be the accept notifications', function () {
            common.buffer.should.have.lengthOf(2);
            for (const id of [body.bookings[0], propertyID]) {
                let msg = common.buffer.pop();
                msg.should.be.an("object");
                msg.should.have.property("url", id);
                msg.should.have.property("type", "accept");
            }
        });
    });

    describe('actor0 deletes the property', function () {
        const body = {};
        const bookings = {};

        it('(should create message body)', function () {
            body.property = propertyID;
        });

        it('property should contain some bookings', function (done) {
            chai.request(propertyInDetailsURL)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property("_id", propertyID);
                    const property = res.body;
                    property.should.have.property("waitingList");
                    property.waitingList.should.be.an("array").that.have.lengthOf(1);
                    bookings.actor2 = property.waitingList.pop()._id;
                    property.should.have.property("rentals");
                    property.rentals.should.be.an("array").that.have.lengthOf(1);
                    bookings.actor1 = property.rentals.pop()._id;
                    done();
                });
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/delete", actors[0], rentalSecretary, body);
        for(const index of [0,1,2])
            activityHelper.shouldReceiveActivity("actor0" + index, common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[index]), rentalSecretary);

        it('should be the deletion notifications', function () {
            common.buffer.should.have.lengthOf(3);
            let msg;
            while (msg = common.buffer.pop()) {
                msg.should.be.an("object");
                msg.should.have.property("url", propertyID);
                msg.should.have.property("type", "delete");
                msg.should.have.property("details");
                const details = msg.details;
                details.should.be.an("object");
                details.should.have.property("name", newProperty.name);
                details.should.have.property("city", newProperty.city);
                details.should.have.property("province", newProperty.province);
            }
        });

        it('property should not exist anymore', function (done) {
            chai.request(propertyID)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    chai.expect(res.body).to.be.null;
                    done();
                });
        });

        it('actor1\'s booking should not exist anymore', function (done) {
            chai.request(bookings.actor1)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.body.should.be.empty;
                    done();
                });
        });

        it('actor2\'s booking should not exist anymore', function (done) {
            chai.request(bookings.actor1)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.body.should.be.empty;
                    done();
                });
        });
    });
});
