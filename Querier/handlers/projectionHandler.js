function generateGetObjectsQuery(ids) {
    ids = toString(ids);
    return "options({\n" +
        "    $includeLinks: false,\n" +
        "    reorderEvents: false,\n" +
        "    processingLag: 0\n" +
        "})\n" +
        "\n" +
        "fromStream('rental')\n" +
        ".when({\n" +
        "    $init:function(){\n" +
        "        return {\n" +
        "            list: []\n" +
        "        }\n" +
        "    },\n" +
        "    $any: function(state, event){\n" +
        "        if (event.data !== undefined) {\n" +
        "            if (" + ids + ".includes(event.data.id) \n" +
        "            || (event.data.object !== undefined && " + ids + ".includes(event.data.object.id))) {\n" +
        "                state.list.push(event.data);\n" +
        "            }\n" +
        "        }\n" +
        "    }\n" +
        "})";
}

function toString(array) {
    var out = "[";
    for(const item of array) out += "\"" + item + "\","
    out += "]";
    return out
}

module.exports = {
    generateGetObjectsQuery,
};
