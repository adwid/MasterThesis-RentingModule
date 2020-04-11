const PropertyModel = require('../models/property');

function createNewProperty(noteObject) {
    var content = noteObject.content;
    content._id = noteObject.id;
    const newProperty = new PropertyModel(content);
    return newProperty.save();
}

module.exports = {
    createNewProperty
};
