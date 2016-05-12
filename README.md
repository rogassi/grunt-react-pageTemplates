[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]

# grunt-react-pageTemplates

> [React Templates](https://github.com/wix/react-templates) grunt task

## Getting Started
This plugin requires Grunt.

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

### Installation
```shell
npm install grunt-react-templates --save-dev
```
### Usage

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-react-pageTemplates');
```

Once you define a target inside the task, e.g. `dist`, you can run
```bash
$ grunt reactPageTemplates:dist
```
or:
```bash
$ grunt react-pageTemplates:dist
 ```

### Configuration
In your project's Gruntfile, add a section named `reactPageTemplates` to the data object passed into `grunt.initConfig()`. The options (and defaults) are:

```js
grunt.initConfig({
  reactTemplates: {
    dist: {
      src: ['**/*.rt'] //glob patterns of files to be processed
      options: {
        modules: 'none',  //possible values: (amd|commonjs|es6|typescript|none)
        format: 'stylish' //possible values: (stylish|json)
      }
    }
  }
})
```
---
for more options, see the [react-templates cli docs](https://github.com/wix/react-templates/blob/gh-pages/docs/cli.md).

## License
Copyright (c) 2016 Rogassi Enterprises. Licensed under the MIT license.

[npm-image]: https://img.shields.io/npm/v/grunt-react-page-templates.svg?style=flat-square
[npm-url]: https://npmjs.org/package/grunt-react-page-templates
[travis-image]: https://img.shields.io/travis/rogassi/grunt-react-page-templates/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/rogassi/grunt-react-page-templates
[coveralls-image]: https://img.shields.io/coveralls/rogassi/grunt-react-page-templates/master.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/rogassi/grunt-react-page-templates?branch=master
[downloads-image]: http://img.shields.io/npm/dm/grunt-react-page-templates.svg?style=flat-square
[downloads-url]: https://npmjs.org/package/grunt-react-page-templates
