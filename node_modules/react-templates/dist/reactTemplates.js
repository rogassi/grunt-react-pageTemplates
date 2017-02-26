'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var cheerio = require('cheerio');
var _ = require('lodash');
var esprima = require('esprima');
var escodegen = require('escodegen');
var reactDOMSupport = require('./reactDOMSupport');
var reactNativeSupport = require('./reactNativeSupport');
var reactPropTemplates = require('./reactPropTemplates');
var rtError = require('./RTCodeError');
var reactSupport = require('./reactSupport');
var templates = reactSupport.templates;
var utils = require('./utils');
var validateJS = utils.validateJS;
var RTCodeError = rtError.RTCodeError;

var repeatTemplate = _.template('_.map(<%= collection %>,<%= repeatFunction %>.bind(<%= repeatBinds %>))');
var ifTemplate = _.template('((<%= condition %>)?(<%= body %>):null)');
var propsTemplateSimple = _.template('_.assign({}, <%= generatedProps %>, <%= rtProps %>)');
var propsTemplate = _.template('mergeProps( <%= generatedProps %>, <%= rtProps %>)');

var propsMergeFunction = 'function mergeProps(inline,external) {\n    var res = _.assign({},inline,external)\n    if (inline.hasOwnProperty(\'style\')) {\n        res.style = _.defaults(res.style, inline.style);\n    }\n    if (inline.hasOwnProperty(\'className\') && external.hasOwnProperty(\'className\')) {\n        res.className = external.className + \' \' + inline.className;\n    }\n    return res;\n}\n';

var classSetTemplate = _.template('_.transform(<%= classSet %>, function(res, value, key){ if(value){ res.push(key); } }, []).join(" ")');

function getTagTemplateString(simpleTagTemplate, shouldCreateElement) {
    if (simpleTagTemplate) {
        return shouldCreateElement ? 'React.createElement(<%= name %>,<%= props %><%= children %>)' : '<%= name %>(<%= props %><%= children %>)';
    }
    return shouldCreateElement ? 'React.createElement.apply(this, [<%= name %>,<%= props %><%= children %>])' : '<%= name %>.apply(this, [<%= props %><%= children %>])';
}

var commentTemplate = _.template(' /* <%= data %> */ ');

var repeatAttr = 'rt-repeat';
var ifAttr = 'rt-if';
var classSetAttr = 'rt-class';
var classAttr = 'class';
var scopeAttr = 'rt-scope';
var propsAttr = 'rt-props';
var templateNode = 'rt-template';
var virtualNode = 'rt-virtual';
var includeNode = 'rt-include';
var includeSrcAttr = 'src';
var requireAttr = 'rt-require';
var importAttr = 'rt-import';
var statelessAttr = 'rt-stateless';
var preAttr = 'rt-pre';

var reactTemplatesSelfClosingTags = [includeNode];

/**
 * @param {Options} options
 * @return {Options}
 */
function getOptions(options) {
    options = options || {};
    var defaultOptions = {
        version: false,
        force: false,
        format: 'stylish',
        targetVersion: reactDOMSupport.default,
        lodashImportPath: 'lodash',
        native: false,
        nativeTargetVersion: reactNativeSupport.default
    };

    var finalOptions = _.defaults({}, options, defaultOptions);
    finalOptions.reactImportPath = reactImport(finalOptions);
    finalOptions.modules = finalOptions.modules || (finalOptions.native ? 'commonjs' : 'none');

    var defaultPropTemplates = finalOptions.native ? reactPropTemplates.native[finalOptions.nativeTargetVersion] : reactPropTemplates.dom[finalOptions.targetVersion];

    finalOptions.propTemplates = _.defaults({}, options.propTemplates, defaultPropTemplates);
    return finalOptions;
}

function reactImport(options) {
    if (options.native) {
        return reactNativeSupport[options.nativeTargetVersion].react.module;
    }
    if (!options.reactImportPath) {
        var isNewReact = _.includes(['0.14.0', '0.15.0', '15.0.0', '15.0.1'], options.targetVersion);
        return isNewReact ? 'react' : 'react/addons';
    }
    return options.reactImportPath;
}

/**
 * @param {Context} context
 * @param {string} namePrefix
 * @param {string} body
 * @param {*?} params
 * @return {string}
 */
function generateInjectedFunc(context, namePrefix, body, params) {
    params = params || context.boundParams;
    var funcName = namePrefix.replace(',', '') + (context.injectedFunctions.length + 1);
    var funcText = 'function ' + funcName + '(' + params.join(',') + ') {\n        ' + body + '\n        }\n        ';
    context.injectedFunctions.push(funcText);
    return funcName;
}

function generateTemplateProps(node, context) {
    var templatePropCount = 0;
    var propTemplateDefinition = context.options.propTemplates[node.name];
    var propertiesTemplates = _(node.children).map(function (child, index) {
        var templateProp = null;
        if (child.name === templateNode) {
            // Generic explicit template tag
            if (!_.has(child.attribs, 'prop')) {
                throw RTCodeError.build(context, child, 'rt-template must have a prop attribute');
            }
            if (_.filter(child.children, { type: 'tag' }).length !== 1) {
                throw RTCodeError.build(context, child, "'rt-template' should have a single non-text element as direct child");
            }

            var childTemplate = _.find(context.options.propTemplates, { prop: child.attribs.prop }) || { arguments: [] };
            templateProp = {
                prop: child.attribs.prop,
                arguments: (child.attribs.arguments ? child.attribs.arguments.split(',') : childTemplate.arguments) || []
            };
        } else if (propTemplateDefinition && propTemplateDefinition[child.name]) {
            // Implicit child template from configuration
            templateProp = {
                prop: propTemplateDefinition[child.name].prop,
                arguments: child.attribs.arguments ? child.attribs.arguments.split(',') : propTemplateDefinition[child.name].arguments
            };
        }

        if (templateProp) {
            _.assign(templateProp, { childIndex: index - templatePropCount++, content: _.find(child.children, { type: 'tag' }) });
        }

        return templateProp;
    }).compact().value();

    return _.transform(propertiesTemplates, function (props, templateProp) {
        var functionParams = _.values(context.boundParams).concat(templateProp.arguments);

        var oldBoundParams = context.boundParams;
        context.boundParams = context.boundParams.concat(templateProp.arguments);

        var functionBody = 'return ' + convertHtmlToReact(templateProp.content, context);
        context.boundParams = oldBoundParams;

        var generatedFuncName = generateInjectedFunc(context, templateProp.prop, functionBody, functionParams);
        props[templateProp.prop] = genBind(generatedFuncName, _.values(context.boundParams));

        // Remove the template child from the children definition.
        node.children.splice(templateProp.childIndex, 1);
    }, {});
}

/**
 * @param node
 * @param {Context} context
 * @return {string}
 */
function generateProps(node, context) {
    var props = {};
    _.forOwn(node.attribs, function (val, key) {
        var propKey = reactSupport.attributesMapping[key.toLowerCase()] || key;
        if (props.hasOwnProperty(propKey) && propKey !== reactSupport.classNameProp) {
            throw RTCodeError.build(context, node, 'duplicate definition of ' + propKey + ' ' + JSON.stringify(node.attribs));
        }
        if (_.startsWith(key, 'on') && !utils.isStringOnlyCode(val)) {
            props[propKey] = handleEventHandler(val, context, node, key);
        } else if (key === 'style' && !utils.isStringOnlyCode(val)) {
            props[propKey] = handleStyleProp(val, node, context);
        } else if (propKey === reactSupport.classNameProp) {
            // Processing for both class and rt-class conveniently return strings that
            // represent JS expressions, each evaluating to a space-separated set of class names.
            // We can just join them with another space here.
            var existing = props[propKey] ? props[propKey] + ' + " " + ' : '';
            if (key === classSetAttr) {
                props[propKey] = existing + classSetTemplate({ classSet: val });
            } else if (key === classAttr || key === reactSupport.classNameProp) {
                props[propKey] = existing + utils.convertText(node, context, val.trim());
            }
        } else if (!_.startsWith(key, 'rt-')) {
            props[propKey] = utils.convertText(node, context, val.trim());
        }
    });
    _.assign(props, generateTemplateProps(node, context));

    // map 'className' back into 'class' for custom elements
    if (props[reactSupport.classNameProp] && isCustomElement(node.name)) {
        props[classAttr] = props[reactSupport.classNameProp];
        delete props[reactSupport.classNameProp];
    }

    var propStr = _.map(props, function (v, k) {
        return JSON.stringify(k) + ' : ' + v;
    }).join(',');
    return '{' + propStr + '}';
}

function handleEventHandler(val, context, node, key) {
    var funcParts = val.split('=>');
    if (funcParts.length !== 2) {
        throw RTCodeError.build(context, node, 'when using \'on\' events, use lambda \'(p1,p2)=>body\' notation or use {} to return a callback function. error: [' + key + '=\'' + val + '\']');
    }
    var evtParams = funcParts[0].replace('(', '').replace(')', '').trim();
    var funcBody = funcParts[1].trim();
    var params = context.boundParams;
    if (evtParams.trim() !== '') {
        params = params.concat([evtParams.trim()]);
    }
    var generatedFuncName = generateInjectedFunc(context, key, funcBody, params);
    return genBind(generatedFuncName, context.boundParams);
}

function genBind(func, args) {
    var bindArgs = ['this'].concat(args);
    return func + '.bind(' + bindArgs.join(',') + ')';
}

function handleStyleProp(val, node, context) {
    var styleStr = _(val).split(';').map(_.trim).filter(function (i) {
        return _.includes(i, ':');
    }).map(function (i) {
        var pair = i.split(':');
        var key = pair[0].trim();
        if (/\{|}/g.test(key)) {
            throw RTCodeError.build(context, node, 'style attribute keys cannot contain { } expressions');
        }
        var value = pair.slice(1).join(':').trim();
        var parsedKey = /(^-moz-)|(^-o-)|(^-webkit-)/ig.test(key) ? _.upperFirst(_.camelCase(key)) : _.camelCase(key);
        return parsedKey + ' : ' + utils.convertText(node, context, value.trim());
    }).join(',');
    return '{' + styleStr + '}';
}

/**
 * @param {string} tagName
 * @param context
 * @return {string}
 */
function convertTagNameToConstructor(tagName, context) {
    if (context.options.native) {
        var targetSupport = reactNativeSupport[context.options.nativeTargetVersion];
        return _.includes(targetSupport.components, tagName) ? targetSupport.reactNative.name + '.' + tagName : tagName;
    }
    var isHtmlTag = _.includes(reactDOMSupport[context.options.targetVersion], tagName) || isCustomElement(tagName);
    if (reactSupport.shouldUseCreateElement(context)) {
        isHtmlTag = isHtmlTag || tagName.match(/^\w+(-\w+)+$/);
        return isHtmlTag ? '\'' + tagName + '\'' : tagName;
    }
    return isHtmlTag ? 'React.DOM.' + tagName : tagName;
}

function isCustomElement(tagName) {
    return tagName.match(/^\w+(-\w+)+$/);
}

/**
 * @param {string} html
 * @param options
 * @param reportContext
 * @return {Context}
 */
function defaultContext(html, options, reportContext) {
    var defaultDefines = [{ moduleName: options.reactImportPath, alias: 'React', member: '*' }, { moduleName: options.lodashImportPath, alias: '_', member: '*' }];
    if (options.native) {
        var targetSupport = reactNativeSupport[options.nativeTargetVersion];
        if (targetSupport.reactNative.module !== targetSupport.react.module) {
            defaultDefines.splice(0, 0, { moduleName: targetSupport.reactNative.module, alias: targetSupport.reactNative.name, member: '*' });
        }
    }
    return {
        boundParams: [],
        injectedFunctions: [],
        html: html,
        options: options,
        defines: options.defines ? _.clone(options.defines) : defaultDefines,
        reportContext: reportContext
    };
}

/**
 * @param node
 * @return {boolean}
 */
function hasNonSimpleChildren(node) {
    return _.some(node.children, function (child) {
        return child.type === 'tag' && child.attribs[repeatAttr];
    });
}

/**
 * Trims a string the same way as String.prototype.trim(), but preserving all non breaking spaces ('\xA0')
 * @param {string} text
 * @return {string}
 */
function trimHtmlText(text) {
    return text.replace(/^[ \f\n\r\t\v\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[ \f\n\r\t\v\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$/g, '');
}

/**
 * @param node
 * @param {Context} context
 * @return {string}
 */
function convertHtmlToReact(node, context) {
    if (node.type === 'tag' || node.type === 'style') {
        var _ret = function () {
            context = _.defaults({
                boundParams: _.clone(context.boundParams)
            }, context);

            if (node.type === 'tag' && node.name === importAttr) {
                throw RTCodeError.build(context, node, "'rt-import' must be a toplevel node");
            }

            if (node.type === 'tag' && node.name === includeNode) {
                var srcFile = node.attribs[includeSrcAttr];
                if (!srcFile) {
                    throw RTCodeError.build(context, node, 'rt-include must supply a source attribute');
                }
                if (!context.options.readFileSync) {
                    throw RTCodeError.build(context, node, 'rt-include needs a readFileSync polyfill on options');
                }
                try {
                    context.html = context.options.readFileSync(srcFile);
                } catch (e) {
                    console.error(e);
                    throw RTCodeError.build(context, node, 'rt-include failed to read file \'' + srcFile + '\'');
                }
                return {
                    v: parseAndConvertHtmlToReact(context.html, context)
                };
            }

            var data = { name: convertTagNameToConstructor(node.name, context) };

            // Order matters. We need to add the item and itemIndex to context.boundParams before
            // the rt-scope directive is processed, lest they are not passed to the child scopes
            if (node.attribs[repeatAttr]) {
                var arr = node.attribs[repeatAttr].split(' in ');
                if (arr.length !== 2) {
                    throw RTCodeError.build(context, node, 'rt-repeat invalid \'in\' expression \'' + node.attribs[repeatAttr] + '\'');
                }
                var repeaterParams = arr[0].split(',').map(function (s) {
                    return s.trim();
                });
                data.item = repeaterParams[0];
                data.index = repeaterParams[1] || data.item + 'Index';
                data.collection = arr[1].trim();
                var bindParams = [data.item, data.index];
                _.forEach(bindParams, function (param) {
                    validateJS(param, node, context);
                });
                validateJS('(' + data.collection + ')', node, context);
                _.forEach(bindParams, function (param) {
                    if (!_.includes(context.boundParams, param)) {
                        context.boundParams.push(param);
                    }
                });
            }

            if (node.attribs[scopeAttr]) {
                handleScopeAttribute(node, context, data);
            }

            if (node.attribs[ifAttr]) {
                validateIfAttribute(node, context, data);
                data.condition = node.attribs[ifAttr].trim();
                if (!node.attribs.key && node.name !== virtualNode) {
                    _.set(node, ['attribs', 'key'], '' + node.startIndex);
                }
            }

            data.props = generateProps(node, context);
            if (node.attribs[propsAttr]) {
                if (data.props === '{}') {
                    data.props = node.attribs[propsAttr];
                } else if (!node.attribs.style && !node.attribs.class) {
                    data.props = propsTemplateSimple({ generatedProps: data.props, rtProps: node.attribs[propsAttr] });
                } else {
                    data.props = propsTemplate({ generatedProps: data.props, rtProps: node.attribs[propsAttr] });
                    if (!_.includes(context.injectedFunctions, propsMergeFunction)) {
                        context.injectedFunctions.push(propsMergeFunction);
                    }
                }
            }

            if (node.name === virtualNode) {
                var invalidAttributes = _.without(_.keys(node.attribs), scopeAttr, ifAttr, repeatAttr);
                if (invalidAttributes.length > 0) {
                    throw RTCodeError.build(context, node, "<rt-virtual> may not contain attributes other than 'rt-scope', 'rt-if' and 'rt-repeat'");
                }

                // provide a key to virtual node children if missing
                if (node.children.length > 1) {
                    _(node.children).reject('attribs.key').forEach(function (child, i) {
                        if (child.type === 'tag' && child.name !== virtualNode) {
                            _.set(child, ['attribs', 'key'], '' + node.startIndex + i);
                        }
                    });
                }
            }

            var children = _.map(node.children, function (child) {
                var code = convertHtmlToReact(child, context);
                validateJS(code, child, context);
                return code;
            });

            data.children = utils.concatChildren(children);

            if (node.name === virtualNode) {
                //eslint-disable-line wix-editor/prefer-ternary
                data.body = '[' + _.compact(children).join(',') + ']';
            } else {
                data.body = _.template(getTagTemplateString(!hasNonSimpleChildren(node), reactSupport.shouldUseCreateElement(context)))(data);
            }

            if (node.attribs[scopeAttr]) {
                var functionBody = _.values(data.innerScope.innerMapping).join('\n') + ('return ' + data.body);
                var generatedFuncName = generateInjectedFunc(context, 'scope' + data.innerScope.scopeName, functionBody, _.keys(data.innerScope.outerMapping));
                data.body = generatedFuncName + '.apply(this, [' + _.values(data.innerScope.outerMapping).join(',') + '])';
            }

            // Order matters here. Each rt-repeat iteration wraps over the rt-scope, so
            // the scope variables are evaluated in context of the current iteration.
            if (node.attribs[repeatAttr]) {
                data.repeatFunction = generateInjectedFunc(context, 'repeat' + _.upperFirst(data.item), 'return ' + data.body);
                data.repeatBinds = ['this'].concat(_.reject(context.boundParams, function (p) {
                    return p === data.item || p === data.index || data.innerScope && p in data.innerScope.innerMapping;
                }));
                data.body = repeatTemplate(data);
            }
            if (node.attribs[ifAttr]) {
                data.body = ifTemplate(data);
            }
            return {
                v: data.body
            };
        }();

        if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
    } else if (node.type === 'comment') {
        var sanitizedComment = node.data.split('*/').join('* /');
        return commentTemplate({ data: sanitizedComment });
    } else if (node.type === 'text') {
        var parentNode = node.parent;
        var overrideNormalize = parentNode !== undefined && (parentNode.name === 'pre' || parentNode.name === 'textarea' || _.has(parentNode.attribs, preAttr));
        var normalizeWhitespaces = context.options.normalizeHtmlWhitespace && !overrideNormalize;
        var text = node.data;
        return trimHtmlText(text) ? utils.convertText(node, context, text, normalizeWhitespaces) : '';
    }
}

/**
 * Parses the rt-scope attribute returning an array of parsed sections
 *
 * @param {String} scope The scope attribute to parse
 * @returns {Array} an array of {expression,identifier}
 * @throws {String} the part of the string that failed to parse
 */
function parseScopeSyntax(text) {
    // the regex below was built using the following pseudo-code:
    // double_quoted_string = `"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"`
    // single_quoted_string = `'[^'\\\\]*(?:\\\\.[^'\\\\]*)*'`
    // text_out_of_quotes = `[^"']*?`
    // expr_parts = double_quoted_string + "|" + single_quoted_string + "|" + text_out_of_quotes
    // expression = zeroOrMore(nonCapture(expr_parts)) + "?"
    // id = "[$_a-zA-Z]+[$_a-zA-Z0-9]*"
    // as = " as" + OneOrMore(" ")
    // optional_spaces = zeroOrMore(" ")
    // semicolon = nonCapture(or(text(";"), "$"))
    //
    // regex = capture(expression) + as + capture(id) + optional_spaces + semicolon + optional_spaces

    var regex = RegExp("((?:(?:\"[^\"\\\\]*(?:\\\\.[^\"\\\\]*)*\"|'[^'\\\\]*(?:\\\\.[^'\\\\]*)*'|[^\"']*?))*?) as(?: )+([$_a-zA-Z]+[$_a-zA-Z0-9]*)(?: )*(?:;|$)(?: )*", 'g');
    var res = [];
    do {
        var idx = regex.lastIndex;
        var match = regex.exec(text);
        if (regex.lastIndex === idx || match === null) {
            throw text.substr(idx);
        }
        if (match.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        res.push({ expression: match[1].trim(), identifier: match[2] });
    } while (regex.lastIndex < text.length);

    return res;
}

function handleScopeAttribute(node, context, data) {
    data.innerScope = {
        scopeName: '',
        innerMapping: {},
        outerMapping: {}
    };

    data.innerScope.outerMapping = _.zipObject(context.boundParams, context.boundParams);

    var scopes = void 0;
    try {
        scopes = parseScopeSyntax(node.attribs[scopeAttr]);
    } catch (scopePart) {
        throw RTCodeError.build(context, node, 'invalid scope part \'' + scopePart + '\'');
    }

    scopes.forEach(function (_ref) {
        var expression = _ref.expression,
            identifier = _ref.identifier;

        validateJS(identifier, node, context);

        // this adds both parameters to the list of parameters passed further down
        // the scope chain, as well as variables that are locally bound before any
        // function call, as with the ones we generate for rt-scope.
        if (!_.includes(context.boundParams, identifier)) {
            context.boundParams.push(identifier);
        }

        data.innerScope.scopeName += _.upperFirst(identifier);
        data.innerScope.innerMapping[identifier] = 'var ' + identifier + ' = ' + expression + ';';
        validateJS(data.innerScope.innerMapping[identifier], node, context);
    });
}

function validateIfAttribute(node, context, data) {
    var innerMappingKeys = _.keys(data.innerScope && data.innerScope.innerMapping || {});
    var ifAttributeTree = null;
    try {
        ifAttributeTree = esprima.parse(node.attribs[ifAttr]);
    } catch (e) {
        throw new RTCodeError(e.message, e.index, -1);
    }
    if (ifAttributeTree && ifAttributeTree.body && ifAttributeTree.body.length === 1 && ifAttributeTree.body[0].type === 'ExpressionStatement') {
        // make sure that rt-if does not use an inner mapping
        if (ifAttributeTree.body[0].expression && utils.usesScopeName(innerMappingKeys, ifAttributeTree.body[0].expression)) {
            throw RTCodeError.buildFormat(context, node, "invalid scope mapping used in if part '%s'", node.attribs[ifAttr]);
        }
    } else {
        throw RTCodeError.buildFormat(context, node, "invalid if part '%s'", node.attribs[ifAttr]);
    }
}

function handleSelfClosingHtmlTags(nodes) {
    return _.flatMap(nodes, function (node) {
        var externalNodes = [];
        node.children = handleSelfClosingHtmlTags(node.children);
        if (node.type === 'tag' && (_.includes(reactSupport.htmlSelfClosingTags, node.name) || _.includes(reactTemplatesSelfClosingTags, node.name))) {
            externalNodes = _.filter(node.children, { type: 'tag' });
            _.forEach(externalNodes, function (i) {
                i.parent = node;
            });
            node.children = _.reject(node.children, { type: 'tag' });
        }
        return [node].concat(externalNodes);
    });
}

function handleRequire(tag, context) {
    var moduleName = void 0;
    var alias = void 0;
    var member = void 0;
    if (tag.children.length) {
        throw RTCodeError.build(context, tag, '\'' + requireAttr + '\' may have no children');
    } else if (tag.attribs.dependency && tag.attribs.as) {
        moduleName = tag.attribs.dependency;
        member = '*';
        alias = tag.attribs.as;
    }
    if (!moduleName) {
        throw RTCodeError.build(context, tag, '\'' + requireAttr + '\' needs \'dependency\' and \'as\' attributes');
    }
    context.defines.push({ moduleName: moduleName, member: member, alias: alias });
}

function handleImport(tag, context) {
    var moduleName = void 0;
    var alias = void 0;
    var member = void 0;
    if (tag.children.length) {
        throw RTCodeError.build(context, tag, '\'' + importAttr + '\' may have no children');
    } else if (tag.attribs.name && tag.attribs.from) {
        moduleName = tag.attribs.from;
        member = tag.attribs.name;
        alias = tag.attribs.as;
        if (!alias) {
            if (member === '*') {
                throw RTCodeError.build(context, tag, "'*' imports must have an 'as' attribute");
            } else if (member === 'default') {
                throw RTCodeError.build(context, tag, "default imports must have an 'as' attribute");
            }
            alias = member;
        }
    }
    if (!moduleName) {
        throw RTCodeError.build(context, tag, '\'' + importAttr + '\' needs \'name\' and \'from\' attributes');
    }
    context.defines.push({ moduleName: moduleName, member: member, alias: alias });
}

function convertTemplateToReact(html, options) {
    var context = require('./context');
    return convertRT(html, context, options);
}

function parseAndConvertHtmlToReact(html, context) {
    var rootNode = cheerio.load(html, {
        lowerCaseTags: false,
        lowerCaseAttributeNames: false,
        xmlMode: true,
        withStartIndices: true
    });
    utils.validate(context.options, context, context.reportContext, rootNode.root()[0]);
    var rootTags = _.filter(rootNode.root()[0].children, { type: 'tag' });
    rootTags = handleSelfClosingHtmlTags(rootTags);
    if (!rootTags || rootTags.length === 0) {
        throw new RTCodeError('Document should have a root element');
    }
    var firstTag = null;
    _.forEach(rootTags, function (tag) {
        if (tag.name === requireAttr) {
            handleRequire(tag, context);
        } else if (tag.name === importAttr) {
            handleImport(tag, context);
        } else if (firstTag === null) {
            firstTag = tag;
            if (_.hasIn(tag, ['attribs', statelessAttr])) {
                context.stateless = true;
            }
        } else {
            throw RTCodeError.build(context, tag, 'Document should have no more than a single root element');
        }
    });
    if (firstTag === null) {
        throw RTCodeError.build(context, rootNode.root()[0], 'Document should have a single root element');
    } else if (firstTag.name === virtualNode) {
        throw RTCodeError.build(context, firstTag, 'Document should not have <' + virtualNode + '> as root element');
    } else if (_.includes(_.keys(firstTag.attribs), repeatAttr)) {
        throw RTCodeError.build(context, firstTag, "root element may not have a 'rt-repeat' attribute");
    }
    return convertHtmlToReact(firstTag, context);
}

/**
 * @param {string} html
 * @param {CONTEXT} reportContext
 * @param {Options?} options
 * @return {string}
 */
function convertRT(html, reportContext, options) {
    options = getOptions(options);

    var context = defaultContext(html, options, reportContext);
    var body = parseAndConvertHtmlToReact(html, context);
    var injectedFunctions = context.injectedFunctions.join('\n');
    var statelessParams = context.stateless ? 'props, context' : '';
    var renderFunction = 'function(' + statelessParams + ') { ' + injectedFunctions + 'return ' + body + ' }';

    var requirePaths = _.map(context.defines, function (d) {
        return '"' + d.moduleName + '"';
    }).join(',');
    var requireNames = _.map(context.defines, function (d) {
        return '' + d.alias;
    }).join(',');
    var AMDArguments = _.map(context.defines, function (d, i) {
        return d.member === '*' ? '' + d.alias : '$' + i;
    }).join(','); //eslint-disable-line
    var AMDSubstitutions = _.map(context.defines, function (d, i) {
        return d.member === '*' ? null : 'var ' + d.alias + ' = $' + i + '.' + d.member + ';';
    }).join('\n'); //eslint-disable-line
    var buildImport = reactSupport.buildImport[options.modules] || reactSupport.buildImport.commonjs;
    var requires = _.map(context.defines, buildImport).join('\n');
    var header = options.flow ? '/* @flow */\n' : '';
    var vars = header + requires;
    var data = {
        renderFunction: renderFunction,
        requireNames: requireNames,
        requirePaths: requirePaths,
        AMDArguments: AMDArguments,
        AMDSubstitutions: AMDSubstitutions,
        vars: vars,
        name: options.name
    };
    var code = templates[options.modules](data);
    if (options.modules !== 'typescript' && options.modules !== 'jsrt') {
        code = parseJS(code, options);
    }
    return code;
}

function parseJS(code, options) {
    try {
        var tree = esprima.parse(code, { range: true, tokens: true, comment: true, sourceType: 'module' });
        // fix for https://github.com/wix/react-templates/issues/157
        // do not include comments for es6 modules due to bug in dependency "escodegen"
        // to be removed when https://github.com/estools/escodegen/issues/263 will be fixed
        // remove also its test case "test/data/comment.rt.es6.js"
        if (options.modules !== 'es6') {
            tree = escodegen.attachComments(tree, tree.comments, tree.tokens);
        }
        return escodegen.generate(tree, { comment: true });
    } catch (e) {
        throw new RTCodeError(e.message, e.index, -1);
    }
}

function convertJSRTToJS(text, reportContext, options) {
    options = getOptions(options);
    options.modules = 'jsrt';
    var templateMatcherJSRT = /<template>([^]*?)<\/template>/gm;
    var code = text.replace(templateMatcherJSRT, function (template, html) {
        return convertRT(html, reportContext, options).replace(/;$/, '');
    });

    return parseJS(code, options);
}

module.exports = {
    convertTemplateToReact: convertTemplateToReact,
    convertRT: convertRT,
    convertJSRTToJS: convertJSRTToJS,
    RTCodeError: RTCodeError,
    normalizeName: utils.normalizeName
};