const axios = require('axios');

// Token got from user01 creation
//  (To get a new one, create a new user and use the API to get the token)
const bearerToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJzdWIiOiJ1c2VyMDEiLCJpYXQiOjE1ODk4NzQyMDYsImV4cCI6MTU5MDQ3OTAwNn0.' +
    'YX8Rw22FaNawp3FWYsIeXYnI8nZ2JhyyUwEZgYJjWLg';

const getActorURL = process.env.PREFIX + process.env.HOST + ":" + process.env.ACTOR_QUERY_PORT + "/actor/get/";
const createActorURL = process.env.PREFIX + process.env.HOST + ":" + process.env.ACTOR_COMMAND_PORT + "/actor/create/";

function createActor(name) {
    return axios.get(getActorURL + name)
        .catch(function (err) {
            const response = err.response;
            if(response === undefined) return Promise.reject(err);
            if (response.hasOwnProperty("status") && response.status === 500
                && response.hasOwnProperty("data") && response.data.message === "missing")
                return axios.post(createActorURL, {
                    "user": "user01",
                    "type": "Person",
                    "id": name,
                    "name": "Foo",
                    "summary": "I like Bar !"
                }, {
                    headers: { Authorization: bearerToken }
                })
            return Promise.reject(err);
        });
}

function init(actors) {
    return Promise.all(actors.map(actor => createActor(actor)))
        .then(_ => {
            return actors.map(actor => getActorURL + actor);
        });
}

module.exports = {
    init,
}
