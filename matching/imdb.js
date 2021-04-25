const nameToImdb = require('name-to-imdb')

module.exports = {
	folderNameToImdb: (obj, cb) => {
		nameToImdb(obj, (err, res, inf) => {
			if ((res || '').startsWith('tt')) {
				cb(res)
			} else {
				cb(false)
			}
		})
	},
	idInFolder: folderName => {
		folderName = folderName || ''
		folderName = folderName.toLowerCase()
		// imdb id in curly brackets
		const imdbIdMatches1 = folderName.match(/\s?\{imdb\-tt([0-9]+)\}/)
		if ((imdbIdMatches1 || []).length == 2) {
			return 'tt' + imdbIdMatches1[1]
		} else {
			// imdb id in brackets
			const imdbIdMatches2 = folderName.match(/\s?\[imdb\-tt([0-9]+)\]/)
			if ((imdbIdMatches2 || []).length == 2) {
				return 'tt' + imdbIdMatches2[1]
			}
		}
		return false
	}
}
