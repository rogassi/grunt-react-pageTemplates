//'use strict';
module.exports = function register(grunt) {
    grunt.registerMultiTask('reactPageTemplates', function () {
        try {

            var rtOptions = this.options();
            var path = require('path');
            var rt = require('react-templates');
            var fs = require('fs');
            var vm = require('vm');
            var path = require('path');

            var generateKeystoneRoutes = false;

            if (rtOptions.generateKeystoneRoutes != null && rtOptions.generateKeystoneRoutes) {
                generateKeystoneRoutes = true;
            }

            var tsc = path.join(path.dirname(require.resolve("typescript")), "tsc.js");
            var tscScript = vm.createScript(fs.readFileSync(tsc, "utf8"), tsc);
            var libPath = path.join(path.dirname(require.resolve("typescript")), "lib.d.ts")
            var tsdPath = path.resolve(__dirname + '/../../../client/typings/tsd.d.ts');

            var options = {
                nodeLib: false,
                targetES5: true,
                moduleKind: 'commonjs',
            };

            function merge(a, b) {
                if (a && b) {
                    for (var key in b) {
                        a[key] = b[key];
                    }
                }
                return a;
            };

            function compileTS(fileName) {
                var exitCode = 0;

                var argv = [
                  "node",
                  "tsc.js",
                  "--nolib",
                  "--target",
                  options.targetES5 ? "ES5" : "ES3", !!options.moduleKind ? "--module" : "", !!options.moduleKind ? options.moduleKind : "",
                  "--jsx",
                  "react",
                  libPath,
                  tsdPath,
                  fileName
                ];

                var proc = merge(merge({}, process), {
                    argv: argv,
                    exit: function (code) {
                        if (code !== 0 && options.exitOnError) {
                            console.error('Fatal Error. Unable to compile TypeScript file. Exiting.');
                            process.exit(code);
                        }
                        exitCode = code;
                    }
                });

                var sandbox = {
                    process: proc,
                    require: require,
                    module: module,
                    Buffer: Buffer,
                    setTimeout: setTimeout
                };

                tscScript.runInNewContext(sandbox);

                if (exitCode != 0) {
                    throw new Error('Unable to compile TypeScript file.');
                }

            }

            var files = this.filesSrc.map(function (file) { return path.resolve(file) });

            files.forEach(function (item, pos, ar) {

                var pathInfo = path.parse(item);

                if (pathInfo.ext == ".html") {

                    var buildIso = false;

                    if (pathInfo.name.indexOf('.rti') > -1) {
                        buildIso = true;
                    }

                    var folderInfo = pathInfo.dir.replace(path.resolve(__dirname + '/../../../client/public'), '');
                    var clientJSFolder = path.resolve(__dirname + '../../../../client/public/js' + folderInfo);

                    try {
                        var templateContent = grunt.file.read(item, { encoding: 'utf8' });
                        var tsTemplate = rt.convertTemplateToReact(templateContent, { modules: 'typescript' })
                        grunt.log.ok("React Template Converted: " + item);
                    } catch (templateError) {
                        grunt.log.error("React Template Conversion Error: " + scaffoldFile + "\r\n");
                        grunt.log.errorlns(templateError.message);
                        return
                    }

                    grunt.file.write(path.resolve(pathInfo.dir + '/' + pathInfo.name.replace(/\.rti/ig, '-rt').replace(/\.rt/ig, '-rt') + '.ts'), tsTemplate, { encoding: 'utf8' });

                    if (buildIso)
                        grunt.file.write(path.resolve(clientJSFolder + '/' + pathInfo.name.replace(/\.rti/ig, '-rt').replace(/\.rt/ig, '-rt') + '.ts'), tsTemplate, { encoding: 'utf8' });

                    var scaffoldFile = path.resolve(pathInfo.dir + '/' + pathInfo.name.replace(/\.rti/ig, '.tsx').replace(/\.rt/ig, '.tsx'));
                    var clientScaffoldFile = path.resolve(clientJSFolder + '/' + pathInfo.name.replace(/\.rti/ig, '.tsx').replace(/\.rt/ig, '.tsx'));

                    var sf = "import * as _template from './" + pathInfo.name.replace(/\.rti/ig, '-rt').replace(/\.rt/ig, '-rt') + "';\r\n" +
        "import * as _ from 'lodash';\r\n" +
                            "import * as React from 'react';\r\n" +
                            "import * as ReactDOM from 'react-dom';\r\n" +
                            "\r\n" +
                            "class template extends React.Component<{}, {}> {\r\n" +
                            "    constructor(props) {\r\n" +
                            "        super(props);\r\n" +
                            "    }\r\n" +
                    //"    public render() { return _template(); }\r\n" +
                            "}\r\n" +
                            "template.prototype.render = _template;\r\n" +
                            "export = template;"

                    if (!grunt.file.exists(scaffoldFile)) {

                        /// Generate Scaffolding File
                        try {
                            grunt.file.write(scaffoldFile, sf, { encoding: 'utf8' });
                            grunt.log.ok("Scaffold File Created: " + scaffoldFile);
                        } catch (scaffoldCreationError) {
                            grunt.log.error("Scaffold File Creation Error: " + scaffoldFile + "\r\n");
                            grunt.log.errorlns(scaffoldCreationError.message);
                        }
                    }

                    if (buildIso && !grunt.file.exists(clientScaffoldFile)) {

                        /// Generate Scaffolding File
                        try {
                            grunt.file.write(clientScaffoldFile, sf, { encoding: 'utf8' });
                            grunt.log.ok("Client Scaffold File Created: " + clientScaffoldFile);
                        } catch (scaffoldCreationError) {
                            grunt.log.error("Client Scaffold File Creation Error: " + clientScaffoldFile + "\r\n");
                            grunt.log.errorlns(scaffoldCreationError.message);
                        }

                    }

                }

            })

            files.forEach(function (item, pos, ar) {

                var pathInfo = path.parse(item);

                if (pathInfo.ext == ".html") {

                    //var buildIso = false;

                    //if (pathInfo.name.indexOf('.rti.html') > -1) {
                    //    buildIso = true;
                    //}

                    var folderInfo = pathInfo.dir.replace(path.resolve(__dirname + '/../../../client/public'), '');

                    var templateFolder = path.resolve(__dirname + '../../../../client/keystone/templates/views' + folderInfo);
                    var routeFolder = path.resolve(__dirname + '../../../../client/keystone/routes/views' + folderInfo);
                    //var clientJSFolder = path.resolve(__dirname + '../../../../client/public/js' + folderInfo);

                    var routeFile = path.resolve(routeFolder + '/' + pathInfo.name.replace(/\.rti/ig, '.ts').replace(/\.rt/ig, '.ts'));

                    var scaffoldFile = path.resolve(pathInfo.dir + '/' + pathInfo.name.replace(/\.rti/ig, '.tsx').replace(/\.rt/ig, '.tsx'));

                    try {
                        compileTS(scaffoldFile);
                        grunt.log.ok("Scaffold File Compiled: " + scaffoldFile);

                        if (generateKeystoneRoutes) {

                            grunt.file.copy(path.resolve(pathInfo.dir + '/' + pathInfo.name.replace(/\.rti/ig, '.js').replace(/\.rt/ig, '.js')), path.resolve(templateFolder + '/' + pathInfo.name.replace(/\.rti/ig, '.js').replace(/\.rt/ig, '.js')), {});

                            grunt.file.copy(path.resolve(pathInfo.dir + '/' + pathInfo.name.replace(/\.rti/ig, '-rt.js').replace(/\.rt/ig, '-rt.js')), path.resolve(templateFolder + '/' + pathInfo.name.replace(/\.rti/ig, '-rt.js').replace(/\.rt/ig, '-rt.js')), {});

                            //if (buildIso) {

                            //    //grunt.file.copy(path.resolve(pathInfo.dir + '/' + pathInfo.name.replace(/.rti/ig, '.js')), path.resolve(clientJSFolder + '/' + pathInfo.name.replace(/.rti/ig, '.js')), {});

                            //    /// COPY THE TEMPLATE TO THE JS DIRECTORY
                            //    ///grunt.file.copy(path.resolve(pathInfo.dir + '/' + pathInfo.name.replace(/.rti/ig, '-rt.js')), path.resolve(clientJSFolder + '/' + pathInfo.name.replace(/.rti/ig, '-rt.js')), {});

                            //}

                            if (!grunt.file.exists(routeFile)) {

                                grunt.file.write(routeFile,
                                /// TS VERSION
                            "import keystone = require('keystone');\r\n" +
                            "export = function (req, res) {\r\n" +
                            "\r\n" +
                            "    var view = new keystone.View(req, res);\r\n" +
                            "    var locals = res.locals;\r\n" +
                            "    locals.req = req;\r\n" +
                            "    locals.res = res;\r\n" +
                            "\r\n" +
                            "    locals.section = '" + (folderInfo == "" ? "" : folderInfo.substr(1) + "/") + pathInfo.name.replace(/\.rti/ig, '').replace(/\.rt/ig, '') + "';\r\n" +
                            "\r\n" +
                            "    // Render the view\r\n" +
                            "    view.render('" + (folderInfo == "" ? "" : folderInfo.substr(1) + "/") + pathInfo.name.replace(/\.rti/ig, '').replace(/\.rt/ig, '') + "');\r\n" +
                            "}\r\n", { encoding: 'utf8' });

                                // JS VERSION 
                                //"var keystone = require('keystone');\r\n" +
                                //"\r\n" +
                                //"exports = module.exports = function (req, res) {\r\n" +
                                //"\r\n" +
                                //"    var view = new keystone.View(req, res);\r\n" +
                                //"    var locals = res.locals;\r\n" +
                                //"\r\n" +
                                //"    // Render the view\r\n" +
                                //"    view.render('" + pathInfo.name.replace(/.rt/ig, '') + "');\r\n" +
                                //"};\r\n", { encoding: 'utf8' });

                            }

                            compileTS(routeFile);

                        }
                    }
                    catch (scaffoldError) {
                        grunt.log.error("Scaffold File Error: " + scaffoldFile + "\r\n");
                        grunt.log.errorlns(scaffoldError.message);
                    }
                }
                else if (pathInfo.ext == ".tsx") {

                    var folderInfo = pathInfo.dir.replace(path.resolve(__dirname + '/../../../client/public'), '');
                    var templateFolder = path.resolve(__dirname + '../../../../client/keystone/templates/views' + folderInfo);

                    try {
                        compileTS(item);
                        grunt.log.ok("Scaffold File Compiled: " + item);
                    }
                    catch (err) {
                        grunt.log.error("Scaffold File Error: " + scaffoldFile + "\r\n");
                        grunt.log.errorlns(scaffoldError.message);
                    }

                    if (generateKeystoneRoutes) {
                        grunt.file.copy(item.replace(/\.tsx/ig, '.js'), path.resolve(templateFolder + '/' + pathInfo.name + '.js'), {});
                    }

                }
                else if (pathInfo.ext == ".ts") {

                    try {
                        compileTS(item);
                        grunt.log.ok("TS File Built: " + item);
                    }
                    catch (err) {
                        grunt.log.error("TS File Error: " + scaffoldFile + "\r\n");
                        grunt.log.errorlns(scaffoldError.message);
                    }
                }

            });

            var exitCode = 0;//require('react-templates').executeOptions(rtOptions);
            grunt.log.ok('processed ' + files.length + ' file' + (files.length > 1 ? 's' : ''));
            return exitCode === 0;

        } catch (e) {
            grunt.log.error('Error: ' + e + ' ' + e.stack());
        }
    });
    grunt.registerTask('react-page-templates', function () {
        grunt.task.run(['reactPageTemplates'].concat(this.args).join(':'));
    });
};
