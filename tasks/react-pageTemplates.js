'use strict';
module.exports = function register(grunt) {
    grunt.registerMultiTask('reactPageTemplates', function () {
        try {

            var rtOptions = this.options();
            var path = require('path');
            var rt = require('react-templates');
            var fs = require('fs');
            var vm = require('vm');
            var path = require('path');

            var tsc = path.join(path.dirname(require.resolve("typescript")), "tsc.js");
            var tscScript = vm.createScript(fs.readFileSync(tsc, "utf8"), tsc);
            var libPath = path.join(path.dirname(require.resolve("typescript")), "lib.d.ts")
            var tsdPath = path.resolve(__dirname + '\\..\\..\\..\\client\\typings\\tsd.d.ts');

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
                try {
                    var templateContent = grunt.file.read(item, { encoding: 'utf8' });
                    var tsTemplate = rt.convertTemplateToReact(templateContent, { modules: 'typescript' })
                    grunt.log.ok("React Template Converted: " + item);
                } catch (templateError) {
                    grunt.log.error("React Template Conversion Error: " + scaffoldFile + "\r\n");
                    grunt.log.errorlns(scaffoldCreationError);
                    return
                }

                grunt.file.write(path.resolve(pathInfo.dir + '/' + pathInfo.name + '.ts'), tsTemplate, { encoding: 'utf8' });

                var scaffoldFile = path.resolve(pathInfo.dir + '/' + pathInfo.name.replace(/.rt/ig, '.tsx'));

                if (!grunt.file.exists(scaffoldFile) || true) {

                    /// Generate Scaffolding File
                    try {
                        grunt.file.write(scaffoldFile, "import * as _template from './" + pathInfo.name + "';\r\n" +
    "import * as _ from 'lodash';\r\n" +
                        "import * as React from 'react';\r\n" +
                        "import * as ReactDOM from 'react-dom';\r\n" +
                        "\r\n" +
                        "class template extends React.Component<{}, {}> {\r\n" +
                        "    constructor(props) {\r\n" +
                        "        super(props);\r\n" +
                        "    }\r\n" +
                        "    public render() { return _template(); }\r\n" +
                        "}\r\n" +
                        "export = template;"
                        , { encoding: 'utf8' });
                        grunt.log.ok("Scaffold File Created: " + scaffoldFile);
                    } catch (scaffoldCreationError) {
                        grunt.log.error("Scaffold File Creation Error: " + scaffoldFile + "\r\n");
                        grunt.log.errorlns(scaffoldCreationError);
                    }

                }

            })

            files.forEach(function (item, pos, ar) {
                var pathInfo = path.parse(item);
                var scaffoldFile = path.resolve(pathInfo.dir + '/' + pathInfo.name.replace(/.rt/ig, '.tsx'));
                try {
                    compileTS(scaffoldFile);
                    grunt.log.ok("Scaffold File Compiled: " + scaffoldFile);
                }
                catch (scaffoldError) {
                    grunt.log.error("Scaffold File Error: " + scaffoldFile + "\r\n");
                    grunt.log.errorlns(scaffoldError);
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
