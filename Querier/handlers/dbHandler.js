const ExampleModel = require('../models/example');

function createNew() {
    const newExample = new ExampleModel({name: "Foo"});
    return newExample.save();
}

module.exports = {
    createNew
};
