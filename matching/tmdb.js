
const needle = require('needle')
const stringHelper = require('../strings')

const tmdbKey = require('../tmdbKey').key

function tmdbToImdb(tmdbId, tmdbType, cb) {
	needle.get('https://api.themoviedb.org/3/' + tmdbType + '/' + tmdbId + '?api_key=' + tmdbKey + '&append_to_response=external_ids', (err, resp, body) => {
		if (((body || {}).external_ids || {}).imdb_id) {
			cb(body.external_ids.imdb_id)
		} else cb(false)
	})
}

function folderNameFromTMDBtoImdb(obj, cb) {
	const tmdbObj = {
		type: obj.type == 'movie' ? 'movie' : 'tv',
		name: obj.name,
		year: obj.year,
	}
	needle.get('https://api.themoviedb.org/3/search/' + tmdbObj.type + '?api_key=' + tmdbKey + '&query=' + encodeURIComponent(tmdbObj.name) + '&include_adult=false' + (tmdbObj.year ? '&' + (tmdbObj.type == 'movie' ? 'year' : 'first_air_date_year') + '=' + tmdbObj.year : ''), (err, resp, body) => {
		let shouldAcceptResult = !!(tmdbObj.year && (((body || {}).results || [])[0] || {}).id)
		if (!shouldAcceptResult && !tmdbObj.year)
			shouldAcceptResult = !!(
										(body || {}).total_results == 1 ||
										stringHelper.sanitizeName((((body || {}).results || [])[0] || {}).title || '') == stringHelper.sanitizeName(tmdbObj.name) ||
										stringHelper.sanitizeName((((body || {}).results || [])[0] || {}).original_title || '') == stringHelper.sanitizeName(tmdbObj.name)
									)
		if (shouldAcceptResult && (((body || {}).results || [])[0] || {}).id) {
			tmdbToImdb(body.results[0].id, tmdbObj.type, cb)
		} else {
			if (tmdbObj.year) {
				delete tmdbObj.year
				folderNameFromTMDBtoImdb(tmdbObj, cb)
			} else {
				cb(false)
			}
		}
	})
}

module.exports = {
	tmdbToImdb,
	folderNameFromTMDBtoImdb,
	idInFolder: folderName => {
		folderName = folderName || ''
		folderName = folderName.toLowerCase()
		// tmdb id in curly brackets
		const tmdbIdMatches1 = folderName.match(/\s?\{tmdb\-([0-9]+)\}/)
		if ((tmdbIdMatches1 || []).length == 2) {
			return tmdbIdMatches1[1]
		} else {
			// tmdb id in brackets
			const tmdbIdMatches2 = folderName.match(/\s?\[tmdb\-([0-9]+)\]/)
			if ((tmdbIdMatches2 || []).length == 2) {
				return tmdbIdMatches2[1]
			}
		}
		return false
	}
}
