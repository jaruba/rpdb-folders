
// this is used so pkg does not pack anything
// from the node_modules folder, this preserves
// native modules

const path = require('path')

module.exports = moduleName => {
	return require(path.join(path.dirname(process.execPath), 'node_modules', moduleName))
}