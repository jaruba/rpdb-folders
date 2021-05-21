const nameToImdb = require('name-to-imdb')

module.exports = {
	folderNameToImdb: (obj, cb) => {
		nameToImdb(obj, (err, res, inf) => {
			if ((res || '').startsWith('tt')) {
				cb(res, inf)
			} else {
				cb(false)
			}
		})
	},
	imdbIdFromUrl: imdbUrl => {
		let imdbId = false
		const imdbPart = imdbUrl
		if (imdbPart) {
			if (imdbPart.startsWith('http')) {
				const matches = imdbPart.match(/\/(tt\d+)\//)
				if (matches.length == 2) {
					imdbId = matches[1]
				}
			} else if (imdbPart.startsWith('tt')) {
				const matches = imdbPart.match(/(tt\d+)/)
				if (matches.length == 2) {
					imdbId = matches[1]
				}
			}
		}
		return imdbId
	},
	idInFolder: folderName => {
		folderName = folderName || ''
		folderName = folderName.toLowerCase()
		// imdb id in curly brackets
		const imdbIdMatches1 = folderName.match(/\s?\{imdb[\-\:\=]tt([0-9]+)\}/)
		if ((imdbIdMatches1 || []).length == 2) {
			return 'tt' + imdbIdMatches1[1]
		} else {
			// imdb id in brackets
			const imdbIdMatches2 = folderName.match(/\s?\[imdb[\-\:\=]tt([0-9]+)\]/)
			if ((imdbIdMatches2 || []).length == 2) {
				return 'tt' + imdbIdMatches2[1]
			}
		}
		return false
	}
}
