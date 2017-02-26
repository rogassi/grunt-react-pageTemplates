'use strict';

var _ = require('lodash');

/**
 * @param {Context} context
 * @return {boolean}
 */
function shouldUseCreateElement(context) {
    switch (context.options.targetVersion) {
        case '0.11.2':
        case '0.11.1':
        case '0.11.0':
        case '0.10.0':
            return false;
        default:
            return true;
    }
}

var reactSupportedAttributes = ['accept', 'acceptCharset', 'accessKey', 'action', 'allowFullScreen', 'allowTransparency', 'alt', 'async', 'autoComplete', 'autoPlay', 'cellPadding', 'cellSpacing', 'charSet', 'checked', 'classID', 'className', 'cols', 'colSpan', 'content', 'contentEditable', 'contextMenu', 'controls', 'coords', 'crossOrigin', 'data', 'dateTime', 'defer', 'dir', 'disabled', 'download', 'draggable', 'encType', 'form', 'formNoValidate', 'frameBorder', 'height', 'hidden', 'href', 'hrefLang', 'htmlFor', 'httpEquiv', 'icon', 'id', 'label', 'lang', 'list', 'loop', 'manifest', 'max', 'maxLength', 'media', 'mediaGroup', 'method', 'min', 'multiple', 'muted', 'name', 'noValidate', 'open', 'pattern', 'placeholder', 'poster', 'preload', 'radioGroup', 'readOnly', 'rel', 'required', 'role', 'rows', 'rowSpan', 'sandbox', 'scope', 'scrolling', 'seamless', 'selected', 'shape', 'size', 'sizes', 'span', 'spellCheck', 'src', 'srcDoc', 'srcSet', 'start', 'step', 'style', 'tabIndex', 'target', 'title', 'type', 'useMap', 'value', 'width', 'wmode'];
var classNameProp = 'className';
var attributesMapping = { 'class': classNameProp, 'rt-class': classNameProp, 'for': 'htmlFor' }; //eslint-disable-line quote-props

_.forEach(reactSupportedAttributes, function (attributeReactName) {
    if (attributeReactName !== attributeReactName.toLowerCase()) {
        attributesMapping[attributeReactName.toLowerCase()] = attributeReactName;
    }
});

var htmlSelfClosingTags = ['area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

var templateAMDTemplate = _.template("define(<%= name ? '\"'+name + '\", ' : '' %>[<%= requirePaths %>], function (<%= AMDArguments %>) {\n'use strict';\n<%= AMDSubstitutions %>return <%= renderFunction %>;\n});");
var templateCommonJSTemplate = _.template("'use strict';\n<%= vars %>\nmodule.exports = <%= renderFunction %>;\n");
var templateES6Template = _.template('<%= vars %>\nexport default <%= renderFunction %>\n');
var templatePJSTemplate = _.template('var <%= name %> = <%= renderFunction %>');
var templateTypescriptTemplate = _.template('<%= vars %>\nexport default <%= renderFunction %>;\n');
var templateJSRTTemplate = _.template('<%= renderFunction %>');

var templates = {
    amd: templateAMDTemplate,
    commonjs: templateCommonJSTemplate,
    typescript: templateTypescriptTemplate,
    es6: templateES6Template,
    none: templatePJSTemplate,
    jsrt: templateJSRTTemplate
};

var isImportAsterisk = _.matches({ member: '*' });
var defaultCase = _.constant(true);

var buildImportTypeScript = _.cond([[isImportAsterisk, function (d) {
    return 'import * as ' + d.alias + ' from \'' + d.moduleName + '\';';
}], [_.matches({ member: 'default' }), function (d) {
    return 'import ' + d.alias + ' from \'' + d.moduleName + '\';';
}], [defaultCase, function (d) {
    return 'import { ' + d.member + ' as ' + d.alias + ' } from \'' + d.moduleName + '\';';
}]]);

var buildImportES6 = _.cond([[isImportAsterisk, function (d) {
    return 'import * as ' + d.alias + ' from \'' + d.moduleName + '\';';
}], [_.matches({ member: 'default' }), function (d) {
    return 'import ' + d.alias + ' from \'' + d.moduleName + '\';';
}], [defaultCase, function (d) {
    return 'import { ' + d.member + ' as ' + d.alias + ' } from \'' + d.moduleName + '\';';
}]]);

var buildImportCommonJS = _.cond([[isImportAsterisk, function (d) {
    return 'var ' + d.alias + ' = require(\'' + d.moduleName + '\');';
}], [defaultCase, function (d) {
    return 'var ' + d.alias + ' = require(\'' + d.moduleName + '\').' + d.member + ';';
}]]);

var buildImport = {
    typescript: buildImportTypeScript,
    es6: buildImportES6,
    commonjs: buildImportCommonJS,
    amd: buildImportCommonJS,
    none: buildImportCommonJS,
    jsrt: buildImportCommonJS
};

module.exports = {
    htmlSelfClosingTags: htmlSelfClosingTags,
    attributesMapping: attributesMapping,
    classNameProp: classNameProp,
    shouldUseCreateElement: shouldUseCreateElement,
    templates: templates,
    buildImport: buildImport
};