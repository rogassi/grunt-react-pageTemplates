'use strict';
//var _ = require('lodash');
//var React = require('react-native');

var ReactText = require('../node_modules/react-native/Libraries/Text/TextStylePropTypes');

function convert() {
    var out = ReactText;
    console.log(out);
}

convert();

module.exports = { convert: convert };