const common = require("../common");
const chai = common.chai;
const activityHelper = require('../helpers/activityHelper');
const db = require('../helpers/dbHelper');

const actors = common.actorsIDs;
const rentalSecretary = common.rentalSecretary;

function shoudldBeErrorAbout(error, type) {
    const div = error.split(":::");
    div.should.have.lengthOf(2);
    div[0].should.be.equal(type);
}

describe("[Rental] No permissions", function () {
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

    describe("actor01 can not book the same property twice on same dates", function () {
        const body = {};

        it('(should create message body)', function () {
            body.property = propertyID;
            body.from = startDate.toISOString();
            body.to = endDate.toISOString();
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/book", actors[1], rentalSecretary, body);
        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/book", actors[1], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor01", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[1]), rentalSecretary);
        activityHelper.shouldReceiveActivity("actor00", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[0]), rentalSecretary);

        it('should be the book and error notifications', function () {
            common.buffer.should.have.lengthOf(3);
            common.buffer.pop(); // skip actor0's msg
            let errMsg = common.buffer.pop();
            let bookMsg = common.buffer.pop();
            bookMsg.should.be.an("object");
            bookMsg.should.have.property("type", "book");
            bookMsg.should.have.property("url");
            errMsg.should.be.an("object");
            errMsg.should.have.property("url", propertyID);
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "book");
            common.buffer.push(bookMsg.url);
        });
    });

    describe('actor1 can not accept his booking', function () {
        const body = {};

        it('(should create message body)', function () {
            common.buffer.should.have.lengthOf(1);
            body.property = propertyID;
            body.bookings = [common.buffer.pop()];
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/accept", actors[1], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor01", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[1]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.have.property("url", propertyID);
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "accept");
            common.buffer.push(body.bookings[0]);
        });

    });

    describe('actor1 can not reject his booking', function () {
        const body = {};

        it('(should create message body)', function () {
            common.buffer.should.have.lengthOf(1);
            body.property = propertyID;
            body.bookings = [common.buffer.pop()];
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/reject", actors[1], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor01", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[1]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.have.property("url", propertyID);
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "reject");
            common.buffer.push(body.bookings[0]);
        });

    });

    describe('actor2 can not cancel actor1\'s booking', function () {
        const body = {};

        it('(should create message body)', function () {
            common.buffer.should.have.lengthOf(1);
            body.booking = common.buffer.pop();
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/cancel", actors[2], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor02", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[2]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.have.property("url", body.booking);
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "cancel");
            common.buffer.push(body.booking);
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
            for (const i in [0, 0]) {
                let msg = common.buffer.pop();
                msg.should.be.an("object");
                msg.should.have.property("type", "accept");
            }
            common.buffer.push(body.bookings[0]);
        });
    });

    describe('actor1 can not cancel accepted booking', function () {
        const body = {};

        it('(should create message body)', function () {
            common.buffer.should.have.lengthOf(1);
            body.booking = common.buffer.pop();
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/cancel", actors[1], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor01", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[1]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.have.property("url", body.booking);
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "cancel");
        });
    });

    describe('actor2 can not book on same dates', function () {
        const body = {};

        it('(should create message body)', function () {
            body.property = propertyID;
            body.from = startDate.toISOString();
            body.to = endDate.toISOString();
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/book", actors[2], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor02", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[2]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.have.property("url", propertyID);
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "book");
        });
    });

    describe('actor1 can not comment the property', function () {
        const body = {};

        it('(should create message body)', function () {
            body.property = propertyID;
            body.comment = "lorem ipsum";
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/comment", actors[1], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor01", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[1]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.have.property("url", propertyID);
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "comment");
        });
    });

    describe('actor1 can not delete the property', function () {
        const body = {};

        it('(should create message body)', function () {
            body.property = propertyID;
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/delete", actors[1], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor01", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[1]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.have.property("url", propertyID);
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "delete");
        });
    });

    describe('actor1 can not update the property', function () {
        const body = {};

        it('(should crate message body)', function () {
            body.property = propertyID;
            body.price = 0;
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/update", actors[1], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor01", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[1]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.have.property("url", propertyID);
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "update");
        });
    });

    describe('actor1 can not close the property', function () {
        const body = {};

        it('(should crate message body)', function () {
            body.property = propertyID;
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/close", actors[1], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor01", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[1]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.have.property("url", propertyID);
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "close");
        });
    });

    describe('actor0 closes the property', function () {
        const body = {};

        it('(should crate message body)', function () {
            body.property = propertyID;
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/close", actors[0], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor00", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[0]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let msg = common.buffer.pop();
            msg.should.be.an("object");
            msg.should.have.property("url", propertyID);
            msg.should.have.property("type", "close");
        });
    });

    describe("actor1 can not book a closed property", function () {
        const body = {};

        it('(should create message body)', function () {
            body.property = propertyID;
            const sdate = new Date();
            sdate.setFullYear(startDate.getFullYear() + 1);
            const edate = new Date();
            edate.setFullYear(sdate.getFullYear() + 1);
            body.from = sdate.toISOString();
            body.to = edate.toISOString();
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/book", actors[1], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor01", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[1]), rentalSecretary);

        it('should be the book and error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.have.property("url", propertyID);
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "book");
        });
    });

    describe('actor1 can not open the property', function () {
        const body = {};

        it('(should crate message body)', function () {
            body.property = propertyID;
        });

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/open", actors[1], rentalSecretary, body);
        activityHelper.shouldReceiveActivity("actor01", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[1]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.have.property("url", propertyID);
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "open");
        });
    });

});
