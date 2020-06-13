const common = require("../common");
const chai = common.chai;
const activityHelper = require('../helpers/activityHelper');
const db = require('../helpers/dbHelper');

const actors = common.actorsIDs;
const rentalSecretary = common.rentalSecretary;

function resetTime(dateISOString) {
    var part = dateISOString.split("T");
    return part[0] + "T00:00:00.000Z"
}

function checkBookingThanksToID(localBooking, propertyID, done) {
    chai.request(localBooking._id)
        .get("")
        .end(function (err, res) {
            chai.expect(err).to.be.null;
            res.should.have.status(200);
            res.body.should.be.a('object');
            const booking = res.body;
            booking.should.have.property("_id", localBooking._id);
            booking.should.have.property("from", localBooking.from);
            booking.should.have.property("to", localBooking.to);
            booking.should.have.property("by", localBooking.by);
            booking.should.have.property("made", localBooking.made);
            booking.should.not.have.property("accepted");
            booking.should.have.property("concern");
            const concern = booking.concern;
            concern.should.be.an("object");
            concern.should.have.property("_id", propertyID);
            done();
        });
}

function bookingShouldBeRejected(bookingID, done) {
    chai.request(bookingID)
        .get("")
        .end(function (err, res) {
            chai.expect(err).to.be.null;
            res.should.have.status(200);
            res.body.should.be.a('object');
            res.body.should.have.property("_id", bookingID);
            res.body.should.have.property("accepted", false);
            done();
        });
}

describe("[Rental] Basic scenario", function () {
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

    before(function (done) {
        db.cleanRentalQuerierDB().then(_ => done())
            .catch(err => {
                throw err
            });
    })

    beforeEach(done => setTimeout(done, common.timeout));

    it("should get the rental's profile", function (done) {
        chai.request(rentalSecretary)
            .get("/")
            .end(function (err, res) {
                chai.expect(err).to.be.null;
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property("inbox");
                res.body.should.have.property("id");
                res.body.should.have.property("type", "Application");
                done();
            });
    });

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

        it('should correctly download the property (using ID)', function (done) {
            chai.request(propertyID)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property("_id", propertyID);
                    const property = res.body;
                    property.should.have.property("name", newProperty.name);
                    property.should.have.property("province", newProperty.province);
                    property.should.have.property("city", newProperty.city);
                    property.should.have.property("capacity", newProperty.capacity);
                    property.should.have.property("price", newProperty.price);
                    property.should.have.property("owner", actors[0]);
                    property.should.have.property("showers", newProperty.showers);
                    property.should.have.property("meadow", newProperty.meadow);
                    property.should.have.property("local", newProperty.local);
                    property.should.have.property("kitchen", newProperty.kitchen);
                    property.should.have.property("campfire", newProperty.campfire);
                    property.should.have.property("description", newProperty.description);
                    property.should.have.property("available", true);
                    done();
                });
        });

        it('should correctly download the property\'s details (using ID)', function (done) {
            chai.request(propertyInDetailsURL)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property("_id", propertyID);
                    const property = res.body;
                    for (const key of ["rentals", "waitingList", "comments"]) {
                        property.should.have.property(key);
                        property[key].should.be.an("array").that.have.lengthOf(0);
                    }
                    done();
                });
        });
    });

    describe("actor[1..3] books the property on the same dates", function () {
        const body = {};

        it('(should crate message body)', function () {
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() + 1);
            const endDate = new Date(startDate.getTime())
            endDate.setDate(endDate.getDate() + 10);
            body.property = propertyID;
            body.from = startDate.toISOString();
            body.to = endDate.toISOString();
        });

        for(const index of [1,2,3])
            activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/book", actors[index], rentalSecretary, body);

        for(const index of [0,1,2,3])
            activityHelper.shouldReceiveActivity("actor0" + index, common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[index]), rentalSecretary);

        it('should be all \'book\' notifications', function () {
            common.buffer.should.have.lengthOf(6);
            // the three first are the messages of each actor (3 2 and 1)
            // the last three are the messages received by actor0
            // (remember that common.buffer acts as a stack)
            for (const index of [3, 2, 1, 3, 2, 1]) {
                let msg = common.buffer.pop();
                msg.should.be.an("object");
                msg.should.have.property("url");
                msg.should.have.property("from", actors[index]);
                msg.should.have.property("type", "book");
            }
        });

        it('property should contains the bookings', function (done) {
            chai.request(propertyInDetailsURL)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property("_id", propertyID);
                    const property = res.body;
                    property.should.have.property("waitingList");
                    property.waitingList.should.be.an("array").that.have.lengthOf(3);
                    for (const index of [3, 2,1]) {
                        const booking = property.waitingList.pop();
                        common.buffer.push(booking);
                        booking.should.be.an("object");
                        booking.should.have.property("concern", propertyID);
                        booking.should.have.property("from", resetTime(body.from));
                        booking.should.have.property("to", resetTime(body.to));
                        booking.should.have.property("by", actors[index]);
                        booking.should.have.property("made");
                        booking.should.have.property("_id");
                    }
                    done();
                });
        });

        it('should be possible to get the bookings thanks to their ID (1/3)', function (done) {
            common.buffer.should.have.lengthOf(3);
            const localBooking = common.buffer.pop();
            checkBookingThanksToID(localBooking, propertyID, done)
        });

        it('should be possible to get the bookings thanks to their ID (2/3)', function (done) {
            common.buffer.should.have.lengthOf(2);
            const localBooking = common.buffer.pop();
            checkBookingThanksToID(localBooking, propertyID, done)
        });

        it('should be possible to get the bookings thanks to their ID (3/3)', function (done) {
            common.buffer.should.have.lengthOf(1);
            const localBooking = common.buffer.pop();
            common.buffer.push(localBooking._id);
            checkBookingThanksToID(localBooking, propertyID, done)
        });

    });

    describe('actor3 cancels his booking', function () {
        const body = {};

        it('(should crate message body)', function () {
            common.buffer.should.have.lengthOf(1);
            body.booking = common.buffer.pop();
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/cancel", actors[3], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor0" + 3, common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[3]), rentalSecretary);

        it('should be the cancel notification', function () {
            common.buffer.should.have.lengthOf(1);
            let msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url");
            msg.should.have.property("from", actors[3]);
            msg.should.have.property("type", "cancel");
        });

        it('booking should not exist anymore', function (done) {
            chai.request(body.booking)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.body.should.be.empty;
                    done();
                });
        });

        it('property\'s waiting list should not contain the canceled booking', function (done) {
            chai.request(propertyInDetailsURL)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property("_id", propertyID);
                    res.body.should.have.property("waitingList");
                    const waitingList = res.body.waitingList;
                    waitingList.should.be.an("array").that.have.lengthOf(2);
                    for (const booking of waitingList) {
                        booking._id.should.not.be.equal(body.booking);
                    }
                    done();
                });
        });
    });

    describe('actor3 books the property (dates not in conflict)', function () {
        const body = {};

        it('(should crate message body)', function () {
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() + 2);
            const endDate = new Date(startDate.getTime())
            endDate.setDate(endDate.getDate() + 10);
            body.property = propertyID;
            body.from = startDate.toISOString();
            body.to = endDate.toISOString();
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/book", actors[3], rentalSecretary, body);

        for (const index of [0, 3])
            activityHelper.shouldReceiveActivity("actor0" + index, common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[index]), rentalSecretary);

        it('should be the \'book\' notifications', function () {
            common.buffer.should.have.lengthOf(2);
            let msg;
            while (msg = common.buffer.pop()) {
                msg.should.be.an("object");
                msg.should.have.property("url");
                msg.should.have.property("from", actors[3]);
                msg.should.have.property("type", "book");
            }
        });

        it('property should contains the bookings', function (done) {
            chai.request(propertyInDetailsURL)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property("_id", propertyID);
                    const property = res.body;
                    property.should.have.property("waitingList");
                    property.waitingList.should.be.an("array").that.have.lengthOf(3);
                    for (const index of [3,2,1]) {
                        const booking = property.waitingList.pop();
                        common.buffer.push(booking);
                        booking.should.be.an("object");
                        booking.should.have.property("by", actors[index]);
                    }
                    done();
                });
        });
    });

    describe("actor0 (owner) accepts actor1's booking", function () {
        const body = {};

        it('(should crate message body)', function () {
            common.buffer.should.have.lengthOf(3);
            body.property = propertyID;
            body.bookings = [common.buffer.pop()._id]; // [actor1's booking]
            common.buffer.pop();
            common.buffer.pop();
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/accept", actors[0], rentalSecretary, body);
        for (const index of [2, 0, 1])
            activityHelper.shouldReceiveActivity("actor0" + index, common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[index]), rentalSecretary);

        it('actor0,1 should have received the same message (accept)', function () {
            common.buffer.should.have.lengthOf(3);
            for (const index of [1, 0]) {
                let msg = common.buffer.pop();
                msg.should.be.an("object");
                msg.should.have.property("url");
                msg.should.have.property("from", actors[0]);
                msg.should.have.property("type", "accept");
            }
        });

        it('actor2 should have received a reject message (because in conflict with accepted booking)', function () {
            common.buffer.should.have.lengthOf(1);
            let msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url");
            msg.should.have.property("from", actors[0]);
            msg.should.have.property("type", "reject");
            common.buffer.push(msg.url);
        });

        it('actor1\'s booking should have the accept flag to true', function (done) {
            chai.request(body.bookings[0])
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property("_id", body.bookings[0]);
                    res.body.should.have.property("accepted", true);
                    done();
                });
        });

        it('actor2\'s booking should have the accept flag to false', function (done) {
            common.buffer.should.have.lengthOf(1);
            const bookingID = common.buffer.pop();
            bookingShouldBeRejected(bookingID, done);
            common.buffer.push(bookingID);
        });

        it('property should be up-to-date', function (done) {
            common.buffer.should.have.lengthOf(1);
            const rejectedBookingID = common.buffer.pop();
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
                    property.waitingList[0].should.have.property("_id");
                    property.waitingList[0]._id.should.not.be.equal(rejectedBookingID);
                    property.waitingList[0]._id.should.not.be.equal(body.bookings[0]);
                    property.should.have.property("rentals");
                    property.rentals.should.be.an("array").that.have.lengthOf(1);
                    property.rentals[0].should.have.property("_id");
                    property.rentals[0]._id.should.be.equal(body.bookings[0]);
                    common.buffer.push(property.waitingList[0]._id, property.rentals[0]._id);
                    done();
                });
        });
    });

    describe("actor0 (owner) rejects actor1 and actor3", function () {
        const body = {};
        let book01ID;
        let book03ID;

        it('(should create message body)', function () {
            common.buffer.should.have.lengthOf(2);
            book01ID = common.buffer.pop();
            book03ID = common.buffer.pop();
            body.property = propertyID;
            body.bookings = [book01ID, book03ID];
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/reject", actors[0], rentalSecretary, body);
        for (const index of [0,1,3])
            activityHelper.shouldReceiveActivity("actor0" + index, common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[index]), rentalSecretary);

        it('should be the reject notifications', function () {
            common.buffer.should.have.lengthOf(3);
            for (const id of [book03ID, book01ID, propertyID]) {
                let msg = common.buffer.pop();
                msg.should.be.an("object");
                msg.should.have.property("url", id);
                msg.should.have.property("from", actors[0]);
                msg.should.have.property("type", "reject");
            }
        });

        it('actor1\'s booking should have the accept flag to false', function (done) {
            bookingShouldBeRejected(book01ID, done);
        });

        it('actor3\'s booking should have the accept flag to false', function (done) {
            bookingShouldBeRejected(book03ID, done);
        });

        it('property should be up-to-date', function (done) {
            common.buffer.should.have.lengthOf(0);
            chai.request(propertyInDetailsURL)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property("_id", propertyID);
                    const property = res.body;
                    property.should.have.property("waitingList");
                    property.waitingList.should.be.an("array").that.have.lengthOf(0);
                    property.should.have.property("rentals");
                    property.rentals.should.be.an("array").that.have.lengthOf(0);
                    common.buffer.push(book01ID);
                    done();
                });
        });

    })

    describe("actor1 should cancel(remove) his booking", function () {
        const body = {};

        it('(should create message body)', function () {
            common.buffer.should.have.lengthOf(1);
            body.booking = common.buffer.pop();
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/cancel", actors[1], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor01", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[1]), rentalSecretary);

        it('should be the cancel notification', function () {
            common.buffer.should.have.lengthOf(1);
            let msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url", propertyID);
            msg.should.have.property("from", actors[1]);
            msg.should.have.property("type", "cancel");
        });

        it('booking should not exist anymore', function (done) {
            chai.request(body.booking)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.body.should.be.empty;
                    done();
                });
        });
    })

    describe("actor0 (owner) closes the property", function () {
        const body = {};

        it('(should create message body)', function () {
            body.property = propertyID;
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/close", actors[0], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor00", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[0]), rentalSecretary);

        it('should be the close notification', function () {
            common.buffer.should.have.lengthOf(1);
            let msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url", propertyID);
            msg.should.have.property("from", actors[0]);
            msg.should.have.property("type", "close");
        });

        it('property should be up-to-date', function (done) {
            chai.request(propertyInDetailsURL)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property("_id", propertyID);
                    const property = res.body;
                    property.should.have.property("available", false);
                    done();
                });
        });
    })

    describe("actor0 (owner) updates the property", function () {
        const body = {};

        it('(should create message body)', function () {
            body.property = propertyID;
            body.price = newProperty.price + 10;
            body.description = "Un très bel endroit pour les mouvements de jeunesse !";
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/update", actors[0], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor00", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[0]), rentalSecretary);

        it('should be the update notification', function () {
            common.buffer.should.have.lengthOf(1);
            let msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url", propertyID);
            msg.should.have.property("from", actors[0]);
            msg.should.have.property("type", "update");
        });

        it('property should be up-to-date', function (done) {
            chai.request(propertyInDetailsURL)
                .get("")
                .end(function (err, res) {
                    chai.expect(err).to.be.null;
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    res.body.should.have.property("_id", propertyID);
                    const property = res.body;
                    property.should.have.property("price", body.price);
                    property.should.have.property("description", body.description);
                    done();
                });
        });
    })

});
