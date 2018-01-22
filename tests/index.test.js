const webpack = require('webpack')
const path = require('path')
const MemoryFS = require("memory-fs")
const AngularNamedLazyChunksWebpackPlugin = require('../index')

let wrapRun = (run) => {
  return () => new Promise((resolve, reject) => {
    run((err, result) => {
      if (err) { return reject(err) }
      return resolve(result.toJson())
    })
  })
}

describe('AngularNamedLazyChunksWebpackPlugin', () => {
  it('single app mode - default config', async () => {
    const fs = new MemoryFS();
    const compiler = webpack({
      entry: path.join(__dirname, 'webpack-apps/default-config/src/main.js'),
      output: { path: __dirname },
      plugins: [ 
        new AngularNamedLazyChunksWebpackPlugin()
      ]
    });

    compiler.outputFileSystem = fs;

    const runAsync = wrapRun(compiler.run.bind(compiler));
    const stats = await runAsync();

    expect(stats.chunks.length).toBe(3);

    const fooChunk = stats.chunks.find(c => c.id === 'foo');

    expect(fooChunk).toBeDefined();

    const barChunk = stats.chunks.find(c => c.id === 'bar');

    expect(barChunk).toBeDefined();

    expect(fooChunk.files[0]).toBe('foo.js');
    expect(barChunk.files[0]).toBe('bar.js');
  });

  it('multi app mode - custom regex', async () => {
    const fs = new MemoryFS();
    const compiler = webpack({
      entry: {
        'app1': path.join(__dirname, 'webpack-apps/multi-app-mode/src/app1.js'),
        'app2': path.join(__dirname, 'webpack-apps/multi-app-mode/src/app2.js')
      },
      output: { path: __dirname },
      plugins: [ 
        new AngularNamedLazyChunksWebpackPlugin({ multiAppMode: true, appNameRegex: 'apps\\\/(.*?)\\\/' })
      ]
    });

    compiler.outputFileSystem = fs;

    const runAsync = wrapRun(compiler.run.bind(compiler));
    const stats = await runAsync();

    expect(stats.chunks.length).toBe(6);

    function verifyAppChunks(appName) {
      const fooChunk = stats.chunks.find(c => c.id === `${appName}.foo`);

      expect(fooChunk).toBeDefined();

      const barChunk = stats.chunks.find(c => c.id === `${appName}.bar`);

      expect(barChunk).toBeDefined();

      expect(fooChunk.files[0]).toBe(`${appName}.foo.js`);
      expect(barChunk.files[0]).toBe(`${appName}.bar.js`);
    }    

    verifyAppChunks('app1');
    verifyAppChunks('app2');
  });
})