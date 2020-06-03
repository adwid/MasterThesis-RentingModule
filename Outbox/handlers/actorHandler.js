const axios = require("axios");

function getInboxAddresses(userIDs) {
    let promises = [];
    if (!Array.isArray(userIDs)) userIDs = [userIDs];

    for (const id of userIDs) promises.push(
        axios.get(id)
            .then(actor => {
                if (actor.data.hasOwnProperty("data")) return convertAddress(actor.data.data.inbox)
                return convertAddress(actor.data.inbox)
            })
            .catch(_ => {}) // ignore the incorrect actors
    );

    return Promise.all(promises).then(addresses => {
        return addresses.filter(addr => addr !== undefined)
    });
}

function convertAddress(addr) {
    let regExp = /https?:\/\/([0-9]{1,3}\.){3,3}[0-9]:[0-9]+(\/inbox)?\/([A-Z]*[a-z]*[0-9]*)+/gi;
    let url = addr.match(regExp) ? process.env.PREFIX + process.env.HOST + ":" + process.env.RENTAL_INBOX_PORT : addr;
    return url
}

module.exports = {
    getInboxAddresses,
};
