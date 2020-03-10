const eventStore = require('node-eventstore-client');

var esConnection = undefined;

function connection() {
    if (esConnection === undefined) {
        var connSettings = {};  // Use defaults
        esConnection = eventStore.createConnection(connSettings, "tcp://localhost:1113", "AgendaModuleInbox");
        esConnection.connect();
        esConnection.once('connected', function (tcpEndPoint) {
            console.log('Connected to eventstore at ' + tcpEndPoint.host + ":" + tcpEndPoint.port);
        });
        esConnection.once('disconnected', noEventStoreConnection);
        esConnection.once('closed', noEventStoreConnection);
    }
    return esConnection;
}

function getCredentials() {
    return {
        username: "admin",
        password: "changeit"
    }
}

function close() {
    if (esConnection !== undefined) {
        esConnection.close();
        esConnection = undefined;
    }
}

function noEventStoreConnection() {
    console.error("An error occurred with the EventStore connection");
    process.exit(1);
}

module.exports = {
    connection,
    getCredentials,
};
