const isDocker = require('is-docker')

const forbiddenChar = process.platform == 'linux' || isDocker() ? '/' : ':'

const browser = require('./browser')

module.exports = async (mediaFolders) => {
	let folders = []
	for (let i = 0; mediaFolders[i]; i++) {
		const dirScan = await browser(mediaFolders[i])
		folders = folders.concat(dirScan)
	}
	return {
		forbiddenChar,
		folders: forbiddenChar + folders.join(forbiddenChar + forbiddenChar) + forbiddenChar
	}
}
