// Based on Angular CLI: https://github.com/angular/angular-cli/blob/f8f42833ec2271270641a4af28174bd823d0370c/packages/%40angular/cli/plugins/named-lazy-chunks-webpack-plugin.ts

const webpack = require('webpack');
const basename = require('path').basename;
const AsyncDependenciesBlock = require('webpack/lib/AsyncDependenciesBlock');
const ContextElementDependency = require('webpack/lib/dependencies/ContextElementDependency');
const ImportDependency = require('webpack/lib/dependencies/ImportDependency');
const CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency');


class AngularNamedLazyChunksWebpackPlugin extends webpack.NamedChunksPlugin {


  constructor(config) {
    config = config || {};

    if (config.nameResolver && (config.appNameRegex || config.multiAppMode)) {
      throw new Error('Specifying "appNameRegex" and/or "multiAppMode" does not have any effect when "nameResolver" function is also specified. Only the "nameResolver" function will be used to determine the name of the chunk.');
    }

    // Append a dot and number if the name already exists.
    function getUniqueName(baseName) {
      let name = baseName;
      let num = 0;
      while (this.nameSet.has(name)) {
        name = `${baseName}.${num++}`;
      }
      this.nameSet.add(name);
      return name;
    }

    function parseAppName(filePath) {
      let appName = null;

      const appNameRegex = config.appNameRegex || 'apps(\\\/|\\\\)(.*?)(\\\/|\\\\)';
      const appNameMatch = new RegExp(appNameRegex).exec(filePath);
      const matchIndex = config.appNameRegex
          ? 1 // Assume that if custom regex is provide the name of the app is the first match
          : 2; // Otherwise, the name of the app is the second match based on the default regex above

      if (appNameMatch && appNameMatch.length > matchIndex) {
        appName = appNameMatch[matchIndex];
      }

      return appName;
    }

    function parseModuleName(filePath) {
      return basename(filePath).replace(/(\.ngfactory)?(\.(js|ts))?$/, '').replace(/\.module$/, '');
    }

    function createChunkNameFromModuleFilePath(filePath) {
      let result = null;

      if (config.nameResolver) {
        result = config.nameResolver(filePath);
      }
      else {
        // Default logic of formatting the name if "nameResolver" is not specified

        let moduleName = parseModuleName(filePath);

        if (moduleName) {
          const appName = config.multiAppMode ? parseAppName(filePath) : null;

          if (appName) {
            // Get rid of the app name prefix in the module file name.
            moduleName = moduleName.replace(`${appName}-`, '');
          }

          result = (appName ? `${appName}.` : '') + moduleName;
        }
      }

      return result;
    }

    const nameResolver = (chunk) => {
      // Entry chunks have a name already, use it.
      if (chunk.name) {
        return chunk.name;
      }

      // Try to figure out if it's a lazy loaded route or import().
      for (let group of chunk.groupsIterable) {
        const blocks = group.getBlocks();

        if (blocks
            && blocks.length > 0
            && blocks[0].dependencies.length > 0
            && blocks[0] instanceof AsyncDependenciesBlock) {
          for (let dep of blocks[0].dependencies) {
            if (dep instanceof ContextElementDependency
                || dep instanceof ImportDependency
                || dep instanceof CommonJsRequireDependency) {
              const req = dep.request;
              let baseName = createChunkNameFromModuleFilePath(req);
              return baseName ? getUniqueName.bind(this)(baseName) : null;
            }
          }
        }
      }

      return null;
    };

    super(nameResolver);
    this.nameSet = new Set();
  }

  apply(compiler) {
    compiler.hooks.compilation.tap("NamedChunksPlugin", compilation => {
      // Clear used chunk names
      this.nameSet.clear();
      compilation.hooks.beforeChunkIds.tap("NamedChunksPlugin", chunks => {
        for (const chunk of chunks) {
          if (chunk.id === null) {
            chunk.id = this.nameResolver(chunk);
          }
        }
      });
    });
  }
}

module.exports = AngularNamedLazyChunksWebpackPlugin;
