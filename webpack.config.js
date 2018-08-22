'use strict';

const { resolve } = require('path');
const revsPlugin = require('./webpack-revs-plugin');
const glob = require('glob');

module.exports = () => ({
  mode: 'development',
  entry: toObject(glob.sync('./test/**/*.js*')),
  output: {
    filename: '[name].js',
  },
  plugins: [new revsPlugin()],
  devtool: 'inline-source-map',
});

function toObject(paths) {
  var ret = {};

  paths.forEach(function(path) {
    // you can define entry names mapped to [name] here
    ret[path.split('/').slice(-1)[0]] = path;
  });

  return ret;
}
