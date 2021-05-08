const needle = require('needle')
const tmdbMatching = require('./tmdb')

const tmdbKey = require('../tmdbKey').key

module.exports = {
	tvdbToImdb: (tvdbId, cb) => {
		needle.get('https://api.themoviedb.org/3/find/'+tvdbId+'?api_key='+tmdbKey+'&language=en-US&external_source=tvdb_id', (err, resp, body) => {
			if (!err && (resp || {}).statusCode == 200 && (((body || {})['tv_results'] || [])[0] || {}).id) {
				tmdbMatching.tmdbToImdb(body['tv_results'][0].id, 'tv', cb)
			} else {
				cb(false)
			}
		})
	},
	idInFolder: folderName => {
		folderName = folderName || ''
		folderName = folderName.toLowerCase()
		// tvdb id in curly brackets
		const tvdbIdMatches1 = folderName.match(/\s?\{tvdb\-([0-9]+)\}/)
		if ((tvdbIdMatches1 || []).length == 2) {
			return tvdbIdMatches1[1]
		} else {
			// tvdb id in brackets
			const tvdbIdMatches2 = folderName.match(/\s?\[tvdb\-([0-9]+)\]/)
			if ((tvdbIdMatches2 || []).length == 2) {
				return tvdbIdMatches2[1]
			}
		}
		return false
	}
}
