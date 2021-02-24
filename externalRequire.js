
// this is used so pkg does not pack anything
// from the node_modules folder, this preserves
// native modules

const fs = require('fs')
const path = require('path')

module.exports = moduleName => {
	let externalPath = path.join(path.dirname(process.execPath), 'node_modules', moduleName)
	if (!fs.existsSync(externalPath))
		externalPath = moduleName
	return require(externalPath)
}
