/**
 * Webpack revs plugin
 *
 * @author Alexander Soldatov
 */

'use strict';

const path = require('path');
const { SyncHook, SyncWaterfallHook } = require('tapable');
const { arrayWrapper } = require('./helpers');

const PLUGIN_NAME = 'WebpackRevsPlugin';

class WebpackRevsPlugin {
  /**
   * @param {object} options - configuration options
   * @constructor
   */
  constructor(options = {}) {
    this.hooks = {
      apply: new SyncHook(['manifest']),
      transform: new SyncWaterfallHook(['assets', 'manifest']),
      done: new SyncHook(['manifest', 'stats']),
    };

    this.hooks.transform.tap(PLUGIN_NAME, assets => {
      console.log('transform', assets);

      return assets;
    });

    this.options = Object.assign(this.defaults, options);

    this.compiler = null;
    this.stats = null;

    this.assets = this.options.assets;
    this.assetNames = new Map();

    // This is used to identify hot module replacement files
    this.hmrRegex = null;
  }

  /**
   * Hook into webpack compiler
   *
   * @param {object} compiler - webpack compiler object
   */
  apply(compiler) {
    this.compiler = compiler;

    const {
      output: { filename, hotUpdateChunkFilename },
    } = compiler.options;

    if (filename !== hotUpdateChunkFilename && typeof hotUpdateChunkFilename === 'string') {
      this.hmrRegex = new RegExp(
        hotUpdateChunkFilename
          .replace(/\./g, '\\.')
          .replace(/\[[a-z]+(:\d+)?\]/gi, (m, n) => (n ? `.{${n.substr(1)}}` : '.+')) + '$',
        'i',
      );
    }

    // compilation.assets contains the results of the build
    compiler.hooks.compilation.tap(PLUGIN_NAME, this.handleCompilation.bind(this));
    compiler.hooks.emit.tapAsync(PLUGIN_NAME, this.handleEmit.bind(this));
    compiler.hooks.afterEmit.tapPromise(PLUGIN_NAME, this.handleAfterEmit.bind(this));
    compiler.hooks.done.tap(PLUGIN_NAME, stats => this.hooks.done.call(this, stats));

    this.hooks.apply.call(this);

    // compiler.hooks.done.tap(PLUGIN_NAME, stats => this.hooks.done.call(this, stats));

    // compiler.plugin('done', stats => {
    //   const { cache } = stats.compilation;
    //   const manifest = Object.keys(cache).map(key => cache[key].hash);
    //   console.log(manifest, this.options);
    // });
  }

  /**
   * Record module asset names
   *
   * @param {object} module
   * @param {string} hashedFile
   */
  handleModuleAsset(module, hashedFile) {
    if (this.isHMR(hashedFile)) {
      return false;
    }

    console.log(module, hashedFile);

    // return this.assetNames.set(
    //   hashedFile,
    //   path.join(path.dirname(hashedFile), path.basename(module.userRequest)),
    // );

    return true;
  }

  /**
   * Hook into the compilation object
   *
   * @param {object} compilation - webpack compilation object
   */
  handleCompilation(compilation) {
    compilation.hooks.moduleAsset.tap(PLUGIN_NAME, this.handleModuleAsset.bind(this));
  }

  /**
   * Handle emit event
   *
   * @param {object} compilation - webpack compilation object
   * @param {Function} cb - callback
   */
  handleEmit(compilation, cb) {
    this.stats = compilation.getStats().toJson();
    this.processAssetsByChunkName(this.stats.assetsByChunkName);
  }

  handleAfterEmit() {}

  /**
   * Get the default options.
   *
   * @return {object}
   */
  get defaults() {
    return {
      output: 'filerevs.json',
      hashLength: 7,
      publicPath: null,
      fileExtRegex: /\.\w{2,4}\.(?:map|gz)$|\.\w+$/i,
    };
  }

  /**
   * Get the file extension.
   *
   * @param  {string} filename
   * @return {string}
   */
  getExtension(filename) {
    if (!filename || typeof filename !== 'string') {
      return '';
    }

    filename = filename.split(/[?#]/)[0];

    if (this.options.fileExtRegex) {
      const ext = filename.match(this.options.fileExtRegex);

      return ext && ext.length ? ext[0] : '';
    }

    return path.extname(filename);
  }

  /**
   * Process compilation assets.
   *
   * @param  {object} assets - Assets by chunk name
   * @return {object}
   */
  processAssetsByChunkName(assets) {
    Object.keys(assets).forEach(chunkName => {
      arrayWrapper(assets[chunkName])
        .filter(f => !this.isHMR(f)) // Remove hot module replacement files
        .forEach(filename => {
          this.assetNames.set(filename, chunkName + this.getExtension(filename));
        });
    });

    return this.assetNames;
  }
}

module.exports = WebpackRevsPlugin;
