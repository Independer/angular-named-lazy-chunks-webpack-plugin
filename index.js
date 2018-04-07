// Based on Angular CLI: https://github.com/angular/angular-cli/blob/f8f42833ec2271270641a4af28174bd823d0370c/packages/%40angular/cli/plugins/named-lazy-chunks-webpack-plugin.ts
// Customized to add multi-app support (prefix chunks with the name of the app) and remove ".module".

const webpack = require('webpack');
const basename = require('path').basename;
const AsyncDependenciesBlock = require('webpack/lib/AsyncDependenciesBlock');
const ContextElementDependency = require('webpack/lib/dependencies/ContextElementDependency');
const ImportDependency = require('webpack/lib/dependencies/ImportDependency');

class AngularNamedLazyChunksWebpackPlugin extends webpack.NamedChunksPlugin {
  constructor(config) {
    config = config || {};

    if (config.nameResolver && (config.appNameRegex || config.multiAppMode)) {
      throw new Error('Specifying "appNameRegex" and/or "multiAppMode" does not have any effect when "nameResolver" function is also specified. Only the "nameResolver" function will be used to determine the name of the chunk.');
    }

    // Append a dot and number if the name already exists.
    const nameMap = new Map();

    function getUniqueName(baseName, request) {
      let name = baseName;
      let num = 0;
      while (nameMap.has(name) && nameMap.get(name) !== request) {
        name = `${baseName}.${num++}`;
      }
      nameMap.set(name, request);
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
          && blocks[0] instanceof AsyncDependenciesBlock
          && blocks[0].dependencies.length === 1
          && (blocks[0].dependencies[0] instanceof ContextElementDependency
            || blocks[0].dependencies[0] instanceof ImportDependency)
        ) {
          const req = blocks[0].dependencies[0].request;
  
          let baseName = createChunkNameFromModuleFilePath(req);
  
          return baseName ? getUniqueName(baseName, req) : null;
        }
      }

      return null;
    };

    super(nameResolver);
  }
}

module.exports = AngularNamedLazyChunksWebpackPlugin;