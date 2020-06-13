const common = require('../common');
const chai = common.chai;
const deepEqual = require('deep-equal');
const clone = require('clone');

function cleanActivity(act) {
    delete act["id"];
    delete act["published"];
    delete act["object"]["id"];
}

function generateCreateActivity(from, to, body) {
    return {
        "@context": "https://www.w3.org/ns/activitystreams",
        "type": "Create",
        "to": [
            to
        ],
        "actor": from,
        "object": {
            "@context": "https://www.w3.org/ns/activitystreams",
            "type": "Note",
            "mediaType": "application/json",
            "attributedTo": from,
            "to": [
                to
            ],
            "content": body
        }
    }
}

function sameActivity(act01, act02, clean) {
    act01 = clone(act01);
    act02 = clone(act02);
    if (clean) {
        cleanActivity(act01);
        cleanActivity(act02);
    }
    return deepEqual(act01, act02);
}

function shouldNotPostActivity(outbox, urn, from, to, body) {
    const activity = generateCreateActivity(from, to, body);
    it("should not post the activity to outbox (" + urn + ")", function (done) {
        outbox.post(urn)
            .send(activity)
            .end(function (err, res) {
                chai.expect(err).to.be.null;
                chai.expect(res.error).to.not.be.undefined;
                chai.expect(res.response).to.be.undefined;
                done();
            });
    });
}

function shouldPostActivity(outbox, urn, from, to, body) {
    const activity = generateCreateActivity(from, to, body);
    shouldPost(outbox, urn, activity);
}

function shouldPost(outbox, urn, activity) {
    let activityCreated;

    it("should post an activity to outbox (" + urn + ")", function (done) {
        outbox.post(urn)
            .send(activity)
            .end(function (err, res) {
                chai.expect(err).to.be.null;
                res.should.have.status(201);
                res.body.should.be.a('object');
                activityCreated = res.body;
                activityCreated.should.have.property("id");
                activityCreated.should.have.property("published");
                activityCreated.should.have.property("object");
                activityCreated.object.should.be.a('object');
                activityCreated.object.should.have.property("id");
                sameActivity(activity, activityCreated, true).should.be.true;
                done();
            });
    });

    it("should get the posted activity (with activity's ID)", function (done) {
        chai.request(activityCreated.id)
            .get("")
            .end(function (err, res) {
                chai.expect(err).to.be.null;
                res.should.have.status(200);
                res.body.should.be.a('object');
                const response = res.body;
                response.should.have.property("id");
                response.should.have.property("published");
                response.should.have.property("object");
                response.object.should.be.a('object');
                response.object.should.have.property("id");
                sameActivity(activityCreated, response, false).should.be.true;
                done();
            });
    });

    it("should get the posted activity (with object's ID)", function (done) {
        chai.request(activityCreated.object.id)
            .get("")
            .end(function (err, res) {
                chai.expect(err).to.be.null;
                res.should.have.status(200);
                res.body.should.be.a('object');
                const response = res.body;
                response.should.have.property("id");
                response.should.have.property("published");
                response.should.have.property("object");
                response.object.should.be.a('object');
                response.object.should.have.property("id");
                sameActivity(activityCreated, response, false).should.be.true;
                done();
            });
    });
}

function shouldReceiveActivity(receiverName, querier, urn, from) {
    it(receiverName + ' should have new message(s)', function (done) {
        querier
            .get(urn)
            .end(function (err, res) {
                chai.expect(err).to.be.null;
                res.should.have.status(200);
                res.body.should.be.an('array');
                const response = res.body;
                response.should.be.an('array').that.is.not.empty;
                for (const activity of response) {
                    shouldReceiveActivityAux(activity, from);
                    common.buffer.push(activity.object.content);
                }
                done()
            })
    });
}

function shouldReceiveActivityAux(activity, from) {
    activity.should.be.an('object');
    activity.should.have.property("id");
    activity.should.have.property("published");
    activity.should.have.property("type", "Create");
    activity.should.have.property("actor", from);
    activity.should.have.property("object");
    activity.object.should.be.a('object');
    activity.object.should.have.property("id");
    activity.object.should.have.property("type", "Note");
    activity.object.should.have.property("attributedTo", from);
    activity.object.should.have.property("content");
}

module.exports = {
    shouldNotPostActivity,
    shouldPostActivity,
    shouldReceiveActivity,
}
