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

describe('AngularNamedLazyChunksWebpackPlugin on Windows', () => {
  it('multi app mode - default config - windows paths', async () => {
    const fs = new MemoryFS();
    const compiler = webpack({
      entry: {
        'app1': path.join(__dirname, 'webpack-apps/multi-app-mode/src/app1.win-paths.js'),
        'app2': path.join(__dirname, 'webpack-apps/multi-app-mode/src/app2.win-paths.js')
      },
      output: { path: __dirname },
      plugins: [ 
        new AngularNamedLazyChunksWebpackPlugin({ multiAppMode: true })
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