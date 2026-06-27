const pkgVersion = require('./node_modules/electron/package.json').version;
console.log('npm pkg version:', pkgVersion);
console.log('binary version:', process.versions.electron);
console.log('MATCH:', pkgVersion === process.versions.electron);
