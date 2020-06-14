const common = require("../common");
const chai = common.chai;
const activityHelper = require('../helpers/activityHelper');
const db = require('../helpers/dbHelper');
const clone = require('clone');

const actors = common.actorsIDs;
const rentalSecretary = common.rentalSecretary;

function shoudldBeErrorAbout(error, type) {
    const div = error.split(":::");
    div.should.have.lengthOf(2);
    div[0].should.be.equal(type);
}

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

    describe('actor0 can not create the same property twice', function () {
        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/create", actors[0], rentalSecretary, newProperty);
        activityHelper.shouldReceiveActivity("actor00", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[0]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.not.have.property("url");
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "create");
        });
    });

    describe('actor1 can not create the same actor0\'s property', function () {
        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/create", actors[1], rentalSecretary, newProperty);
        activityHelper.shouldReceiveActivity("actor00", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[1]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.not.have.property("url");
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "create");
        });
    });

    describe("Property validation - each field", function () {
        let body = {}

        for (const key of Object.keys(newProperty)) {
            it('(create the body message: property creation with field \'' + key + '\' missing)', function () {
                body = clone(newProperty);
                delete body[key];
            });

            activityHelper.shouldNotPostActivity(common.rentalOutbox, "/rental/create", actors[0], common.rentalSecretary, body);
        }
    });

    describe('Property must have a positive number of showers', function () {
        const body = clone(newProperty);
        body.name = body.name + (new Date()); // prevent duplicate error
        body.showers = -2;

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/create", actors[0], rentalSecretary, newProperty);

        activityHelper.shouldReceiveActivity("actor00", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[0]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.not.have.property("url");
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "create");
        });
    });

    describe('Property must have a positive price', function () {
        const body = clone(newProperty);
        body.name = body.name + (new Date()); // prevent duplicate error
        body.price = -2;

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/create", actors[0], rentalSecretary, newProperty);

        activityHelper.shouldReceiveActivity("actor00", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[0]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.not.have.property("url");
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "create");
        });
    });

    describe('Property must have a positive capacity', function () {
        const body = clone(newProperty);
        body.name = body.name + (new Date()); // prevent duplicate error
        body.capacity = -2;

        activityHelper.shouldPostActivity(common.rentalOutbox, "/rental/create", actors[0], rentalSecretary, newProperty);

        activityHelper.shouldReceiveActivity("actor00", common.rentalQuerier, "/rental/news/new/" + encodeURIComponent(actors[0]), rentalSecretary);

        it('should be the error notifications', function () {
            common.buffer.should.have.lengthOf(1);
            let errMsg = common.buffer.pop();
            errMsg.should.be.an("object");
            errMsg.should.not.have.property("url");
            errMsg.should.have.property("type", "error");
            errMsg.should.have.property("error");
            shoudldBeErrorAbout(errMsg.error, "create");
        });
    });
});
