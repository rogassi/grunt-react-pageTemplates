'use strict';

var css = require('css');
var _ = require('lodash');
var rtnData = require('./rt-style-support-data.js');

var templateCommonJSTemplate = _.template('\'use strict\';\nvar style = <%= body %>;\nmodule.exports = style;\n');

function convert(text) {
    return templateCommonJSTemplate({ body: convertBody(text) });
}

function convertBody(text) {
    //source
    var obj = css.parse(text, { silent: false });
    var result = _.reduce(obj.stylesheet.rules, processRule2, {});
    return JSON.stringify(result, undefined, 2);
}

function processRule2(result, rule) {
    var name = rule.selectors[0].substring(1);
    result[name] = _.reduce(rule.declarations, processDeclaration, {});
    return result;
}

function processDeclaration(result, dec) {
    var prop = _.camelCase(dec.property);
    result[prop] = convertValue(prop, dec.value);
    return result;
}

function convertValue(p, v) {
    if (rtnData[p] === 'string') {
        return v;
    }
    // TODO remove units
    return parseInt(v.match(/(\d+)/g)[0], 10);
}

module.exports = {
    convert: convert,
    convertBody: convertBody
};