
const express = require('express')
const app = express()
const needle = require('needle')
const async = require('async')
const chokidar = require('chokidar')
const isDocker = require('is-docker')
const fs = require('fs')
const path = require('path')
const tnp = require('torrent-name-parser')
const open = require('open')
const getPort = require('get-port')
const config = require('./config')
const browser = require('./browser')
const searchStrings = require('./searchStrings')
const fileHelper = require('./files')
const stringHelper = require('./strings')
const imdbMatching = require('./matching/imdb')
const tmdbMatching = require('./matching/tmdb')
const tvdbMatching = require('./matching/tvdb')

let queueDisabled = false

function getCached(folderName, folderType) {
	if (settings.overwriteMatches[folderType][folderName]) {
		return settings.overwriteMatches[folderType][folderName]
	}

	if (settings.cacheMatches && settings.imdbCache[folderType][folderName]) {
		return settings.imdbCache[folderType][folderName]
	}
}

function folderNameToImdb(folderName, folderType, cb, isForced, posterExists) {

	folderName = folderName || ''

	// we skip cache to ensure item is not from last 2 years
	// if it is, we will check the cache again later on
	const skipCache = !!(isForced && posterExists && settings.overwriteLast2Years)

	if (!skipCache) {
		const cached = getCached(folderName, folderType)
		if (cached) {
			cb(cached)
			return
		}
	}

	// clean up folderName:

	const cleanFolderName = stringHelper.cleanFolderName(fileHelper.isVideo(folderName) ? fileHelper.removeExtension(folderName) : folderName)

	const obj = { type: folderType, providers: ['imdbFind'] }

	// it's important to use these regex matches separate:

	// ends with year in parantheses:

	const yearMatch1 = cleanFolderName.match(/ \((\d{4}|\d{4}\-\d{4})\)$/)

	if ((yearMatch1 || []).length > 1) {
		obj.year = yearMatch1[1]
		obj.name = cleanFolderName.replace(/ \((\d{4}|\d{4}\-\d{4})\)$/, '')
	} else {

		// ends with year without parantheses:

		const yearMatch2 = cleanFolderName.match(/ (\d{4}|\d{4}\-\d{4})$/)
		if ((yearMatch2 || []).length > 1) {
			obj.year = yearMatch2[1]
			obj.name = cleanFolderName.replace(/ (\d{4}|\d{4}\-\d{4})$/, '')
		} else {

			// ends with year in brackets:

			const yearMatch2 = cleanFolderName.match(/ \[(\d{4}|\d{4}\-\d{4})\]$/)
			if ((yearMatch2 || []).length > 1) {
				obj.year = yearMatch2[1]
				obj.name = cleanFolderName.replace(/ \[(\d{4}|\d{4}\-\d{4})\]$/, '')
			} else {
				const tnpParsed = tnp(cleanFolderName)

				if (tnpParsed.title) {
					obj.name = tnpParsed.title
					if (tnpParsed.year) {
						obj.year = tnpParsed.year
					} else if (stringHelper.shouldNotParseName(cleanFolderName)) {
						// this is leads to a better match for series
						// possibly for movies too
						obj.name = cleanFolderName
					}
				}
			}

		}
	}

	if (!obj.name)
		obj.name = cleanFolderName.toLowerCase()
	else
		obj.name = obj.name.toLowerCase()

	// "Marvel's ..." can be a special case...
	if (obj.type == 'series' && obj.name.startsWith('marvel'))
		obj.name = obj.name.replace(/^marvel ?'?s /,'')

	if (skipCache && obj.year) {
		const currentYear = new Date().getFullYear()
		if (obj.year != currentYear || obj.year != currentYear -1) {
			// item not from last 2 years
			cb(false)
			return
		} else {
			const cached = getCached(folderName, folderType)
			if (cached) {
				cb(cached)
				return
			}
		}
	}
	if (settings.scanOrder == 'tmdb-imdb') {
		tmdbMatching.folderNameFromTMDBtoImdb(obj, res => {
			if ((res || '').startsWith('tt')) {
				console.log('Matched ' + folderName + ' by TMDB Search')
				settings.imdbCache[folderType][folderName] = res
				cb(res)
			} else {
				imdbMatching.folderNameToImdb(obj, res => {
					if (res) {
						console.log('Matched ' + folderName + ' by IMDB Search')
						settings.imdbCache[folderType][folderName] = res
						cb(res)
					} else cb(false)
				})
			}
		})
	} else if (settings.scanOrder == 'imdb') {
		imdbMatching.folderNameToImdb(obj, res => {
			if (res) {
				console.log('Matched ' + folderName + ' by IMDB Search')
				settings.imdbCache[folderType][folderName] = res
				cb(res)
			} else {
				cb(false)
			}
		})
	} else if (settings.scanOrder == 'tmdb') {
		tmdbMatching.folderNameFromTMDBtoImdb(obj, res => {
			if ((res || '').startsWith('tt')) {
				console.log('Matched ' + folderName + ' by TMDB Search')
				settings.imdbCache[folderType][folderName] = res
				cb(res)
			} else {
				cb(false)
			}
		})
	} else {
		// 'imdb-tmdb'
		imdbMatching.folderNameToImdb(obj, res => {
			if (res) {
				console.log('Matched ' + folderName + ' by IMDB Search')
				settings.imdbCache[folderType][folderName] = res
				cb(res)
			} else {
				tmdbMatching.folderNameFromTMDBtoImdb(obj, res => {
					if ((res || '').startsWith('tt')) {
						console.log('Matched ' + folderName + ' by TMDB Search')
						settings.imdbCache[folderType][folderName] = res
						cb(res)
					} else cb(false)
				})
			}
		})
	}
}

function posterFromImdbId(imdbId, folderLabel) {
	let posterType = settings.posterType
	if (settings.customPosters[imdbId]) {
		let customPoster = settings.customPosters[imdbId].replace('[[api-key]]', settings.apiKey).replace('[[poster-type]]', posterType).replace('[[imdb-id]]', imdbId)
		if (folderLabel) {
			if (customPoster.includes('?')) customPoster += '&'
			else customPoster += '?'
			customPoster += 'label=' + folderLabel
		}
		return customPoster
	} else {
		if (settings.textless)
			posterType = posterType.replace('poster-', 'textless-')
		return 'https://api.ratingposterdb.com/' + settings.apiKey + '/imdb/' + posterType + '/' + imdbId + '.jpg' + (folderLabel ? '?label=' + folderLabel : '')
	}
}


const nameQueue = async.queue((task, cb) => {

	if (queueDisabled) {
		cb()
		return
	}

	console.log('Items left in queue: ' + nameQueue.length())

	const parentMediaFolder = task.isFile ? task.folder : path.resolve(task.folder, '..')

	const folderLabel = settings.labels[parentMediaFolder]

	const posterName = task.posterName || 'poster.jpg'

	const backdropName = task.backdropName || 'background.jpg'

	let targetFolder = task.folder

	if (task.type == 'movie') {
		// handle strange case of concatenated folders
		// - Movie Name (Year)
		// - - Movie Name (Year)
		// - - - Video File

		// if only one item exists in the folder and that item is a folder itself, go one level down
		const folderContents = getDirectories(targetFolder, true)
		if ((folderContents || []).length == 1 && !fileHelper.isVideo(folderContents[0] || '')) {
			targetFolder = folderContents[0]
		}
	}

	if (settings.noPostersToEmptyFolders) {
		const folderHasContents = getDirectories(targetFolder, true)
		if (!(folderHasContents || []).length) {
			console.log(`Skipping empty folder: ${task.name}`)
			cb()
			return
		}
	}

	const posterExists = fs.existsSync(path.join(targetFolder, posterName))

	let backdropExists = false

	if (settings.backdrops) {
		backdropExists = fs.existsSync(path.join(targetFolder, backdropName))
	}

	if (posterExists && !settings.backdrops) {
		if (!task.forced) {
			setTimeout(() => { cb() }, 100)
			return
		}
	}

	if (settings.backdrops && posterExists && backdropExists) {
		if (!task.forced) {
			setTimeout(() => { cb() }, 100)
			return
		}
	}

	let once = false

	let countTasks = 0

	const totalTasks = settings.backdrops ? 2 : 1

	function endIt() {
		countTasks++
		if (countTasks < totalTasks)
			return
		if (once) return
		once = true
		setTimeout(() => { cb() }, 1000) // 1s
	}

	function getPoster(imdbId) {
		if (posterExists && !task.forced) {
			endIt()
			return
		}
		const posterUrl = posterFromImdbId(imdbId, folderLabel)
		needle.get(posterUrl, (err, res) => {
			if (!err && (res || {}).statusCode == 200) {
				fs.writeFile(path.join(targetFolder, posterName), res.raw, (err) => {
					if (err) {
						if (!task.retry) {
							console.log(`Warning: Could not write poster to folder for ${task.name}, trying again in 4h`)
							setTimeout(() => {
								task.retry = true
								nameQueue.push(task)
							}, 4 * 60 * 60 * 1000)
						} else {
							console.log(`Warning: Could not write poster to folder for ${task.name}, tried twice`)
						}
					} else
						console.log(`Poster for ${task.name} downloaded`)
					endIt()
				})
			} else {
				if ((res || {}).statusCode == 403) {
					// we will purge the queue, this can only happen if:
					// - API request limit is reached
					// - requests are done for an unsupported poster type
					// - API key is invalid / disabled
					console.log(res.body)
					queueDisabled = true
				} else {
					console.log('No poster available for ' + task.name)
				}
				endIt()
			}
		})
	}

	function getBackdrop(imdbId) {
		if (backdropExists && !task.forced) {
			endIt()
			return
		}
		const backdropUrl = 'https://api.ratingposterdb.com/' + settings.apiKey + '/imdb/backdrop-default/' + imdbId + '.jpg'
		needle.get(backdropUrl, (err, res) => {
			if (!err && (res || {}).statusCode == 200) {
				fs.writeFile(path.join(targetFolder, backdropName), res.raw, (err) => {
					if (err) {
						console.log(`Warning: Could not write backdrop to folder for ${task.name}`)
					} else
						console.log(`Backdrop for ${task.name} downloaded`)
					endIt()
				})
			} else {
				endIt()
			}
		})
	}

	function getImages(imdbId) {
		if ((imdbId || '').startsWith('tt')) {
			getPoster(imdbId)
			if (settings.backdrops)
				getBackdrop(imdbId)
		} else {
			console.log('Could not match ' + task.name)
			endIt()
			if (settings.backdrops) // end again
				endIt()
		}
	}

	function matchBySearch() {
		folderNameToImdb(task.name, task.type, getImages, task.forced, posterExists)
	}

	// check to see if folder name already contains an id

	const imdbIdInFolderName = imdbMatching.idInFolder(task.name)

	if (imdbIdInFolderName) {
		console.log('Matched ' + task.name + ' by IMDB ID in folder name')
		getImages(imdbIdInFolderName)
	} else {
		const tmdbIdInFolderName = tmdbMatching.idInFolder(task.name)
		if (tmdbIdInFolderName) {
			tmdbMatching.tmdbToImdb(tmdbIdInFolderName, task.type == 'movie' ? 'movie' : 'tv', imdbId => {
				if (imdbId) {
					console.log('Matched ' + task.name + ' by TMDB ID in folder name')
					getImages(imdbId)
				} else {
					matchBySearch()
				}
			})
		} else {
			const tvdbIdInFolderName = tvdbMatching.idInFolder(task.name)
			if (tvdbIdInFolderName && task.type == 'series') {
				// only series supports converting to imdb id
				tvdbMatching.tvdbToImdb(tvdbIdInFolderName, imdbId => {
					if (imdbId) {
						console.log('Matched ' + task.name + ' by TVDB ID in folder name')
						getImages(imdbId)
					} else {
						matchBySearch()
					}
				})
			} else {
				matchBySearch()
			}
		}
	}

}, 1)

nameQueue.drain(() => {
	config.set('imdbCache', settings.imdbCache)
	fullScanRunning = false
	queueDisabled = false
})

const isDirectoryOrVideo = (withVideos, source) => { try { return fs.lstatSync(source).isDirectory() || (withVideos && fileHelper.isVideo(source)) } catch(e) { return false } }
const getDirectories = (source, withVideos) => fs.readdirSync(source).map(name => path.join(source, name)).filter(isDirectoryOrVideo.bind(null, withVideos))

let fullScanRunning = false

function startFetchingPosters(theseFolders, type, forced) {
	let allFolders = []
	theseFolders.forEach(mediaFolder => { allFolders = allFolders.concat(getDirectories(mediaFolder)) })
	if (allFolders.length) {
		fullScanRunning = true
		allFolders.forEach((el) => { const name = el.split(path.sep).pop(); nameQueue.push({ name, folder: el, type, forced }) })
	}
}

const watcher = chokidar.watch('dir', {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  depth: 0,
  usePolling: isDocker(),
})

watcher.on('addDir', el => {
	let type
	for (const [folderType, folders] of Object.entries(settings.mediaFolders)) {
		if (folders.includes(el))
			return
		if (!type)
			folders.some(mediaFolder => {
				if (el.startsWith(mediaFolder)) {
					type = folderType
					return true
				}
			})
	}
	const name = el.split(path.sep).pop()
	console.log(`Directory ${name} has been added to ${type}`)
	nameQueue.push({ name, folder: el, type, forced: false }) 
})

watcher.on('add', el => {
	const name = el.split(path.sep).pop()
	if (!fileHelper.isVideo(name)) {
		return
	}
	let type
	for (const [folderType, folders] of Object.entries(settings.mediaFolders)) {
		if (folders.includes(el))
			return
		if (!type)
			folders.some(mediaFolder => {
				if (el.startsWith(mediaFolder)) {
					type = folderType
					return true
				}
			})
	}
	if (type !== 'movie') {
		return
	}
	console.log(`File ${name} has been added to ${type}`)
	const nameNoExt = fileHelper.removeExtension(name)
	nameQueue.push({ name, folder: path.dirname(el), type, forced: false, isFile: true, posterName: nameNoExt + '.jpg', backdropName: nameNoExt + '-fanart.jpg' }) 
})

function shouldOverwrite(type) {
	// this logic is put in place so users do not
	// consume too many requests by overwriting
	// posters with full scans
	if (!!settings.overwrite && settings.lastOverwrite[type] < Date.now() - settings.minOverwritePeriod)
		return true

	return false
}

function fullUpdate() {
	let anyOverwrite = false
	for (const [type, folders] of Object.entries(settings.mediaFolders)) {
		if (settings.lastFullUpdate[type] < Date.now() - settings.fullUpdate) {
			console.log(`Initiating periodic update of all ${type} folders`)
			settings.lastFullUpdate[type] = Date.now()
			const overwrite = shouldOverwrite(type)
			if (overwrite) {
				anyOverwrite = true
				settings.lastOverwrite[type] = Date.now()
			}
			startFetchingPosters(folders, type, overwrite)
		}
	}
	config.set('lastFullUpdate', settings.lastFullUpdate)
	if (anyOverwrite)
		config.set('lastOverwrite', settings.lastOverwrite)
	setTimeout(() => { fullUpdate() }, settings.checkFullUpdate)
}

let watchedFolders = []

function addToWatcher(arr) {
	const newArr = []
	arr.forEach(el => {
		if (!watchedFolders.includes(el))
			newArr.push(el)
	})
	watchedFolders = watchedFolders.concat(newArr)
	watcher.add(newArr)
}

function removeFromWatcher(folder) {
	const idx = watchedFolders.indexOf(folder)
	if (idx !== -1) {
		watchedFolders.splice(idx, 1)
		watcher.unwatch(folder)
	}
}

function addMediaFolder(type, folder, label) {
	const idx = settings.mediaFolders[type].indexOf(folder)
	if (idx == -1) {
		settings.mediaFolders[type].push(folder)
		config.set('mediaFolders', settings.mediaFolders)
		if (label && label != 'none') {
			settings.labels[folder] = label
			config.set('labels', settings.labels)
		}
		addToWatcher([folder])
	}
}

function removeMediaFolder(type, folder) {
	const idx = settings.mediaFolders[type].indexOf(folder)
	if (idx !== -1) {
		settings.mediaFolders[type].splice(idx, 1)
		config.set('mediaFolders', settings.mediaFolders)
		if (settings.labels[folder]) {
			delete settings.labels[folder]
			config.set('labels', settings.labels)
		}
		removeFromWatcher(folder)
	}
}

function addOverwriteMatch(type, folder, imdbId) {
	settings.overwriteMatches[folder] = imdbId
	config.set('overwriteMatches', settings.overwriteMatches)
}

function updateSetting(name, value) {
	settings[name] = value
	config.set(name, value)
}

function init() {
	let allFolders = []
	for (const [type, folders] of Object.entries(settings.mediaFolders))
		allFolders = allFolders.concat(folders)
	if (allFolders.length)
		addToWatcher(allFolders)
	if (!settings.overwrite) {
		// we consider adding the folders to watcher a full scan
		// on init, only if overwrite is disabled, because it will
		// actually act like a full scan by re-checking all folders
		settings.lastFullUpdate['movie'] = Date.now()
		settings.lastFullUpdate['series'] = Date.now()
		config.set('lastFullUpdate', settings.lastFullUpdate)
	}
	fullUpdate()
}

function validateApiKey() {
	return new Promise((resolve, reject) => {
		needle.get('https://api.ratingposterdb.com/' + settings.apiKey + '/isValid', (err, resp, body) => {
			if (!err && (resp || {}).statusCode == 200) {
				init()
				resolve()
			} else {
				reject()
			}
		})
	})
}

app.get('/setSettings', (req, res) => {
	const posterType = (req.query || {}).posterType || 'poster-default'
	settings.posterType = posterType
	config.set('posterType', settings.posterType)
	const overwritePeriod = (req.query || {}).overwritePeriod || 'overwrite-monthly'
	settings.minOverwritePeriod = overwritePeriod == 'overwrite-monthly' ? 29 * 24 * 60 * 60 * 1000 : 14 * 24 * 60 * 60 * 1000
	config.set('minOverwritePeriod', settings.minOverwritePeriod)
	const overwrite = (req.query || {}).overwrite || false
	if (overwrite == 1 && !settings.overwrite) {
		// this is here to ensure we don't consume too many requests needlessly
		settings.lastOverwrite = { movie: Date.now(), series: Date.now() }
		config.set('lastOverwrite', settings.lastOverwrite)
	}
	settings.overwrite = overwrite == 1 ? true : false
	config.set('overwrite', settings.overwrite)
	const overwrite2years = (req.query || {}).overwrite2years || false
	const overwriteLast2Years = overwrite2years == 1 ? true : false
	if (overwriteLast2Years !== settings.overwriteLast2Years) {
		settings.overwriteLast2Years = overwriteLast2Years
		config.set('overwriteLast2Years', settings.overwriteLast2Years)
	}
	const noEmptyFolders = (req.query || {}).noEmptyFolders || false
	const noPostersToEmptyFolders = noEmptyFolders == 1 ? true : false
	if (noPostersToEmptyFolders !== settings.noPostersToEmptyFolders) {
		settings.noPostersToEmptyFolders = noPostersToEmptyFolders
		config.set('noPostersToEmptyFolders', settings.noPostersToEmptyFolders)
	}
	const shouldCacheMatches = (req.query || {}).cacheMatches || false
	const cacheMatches = shouldCacheMatches == 1 ? true : false
	if (cacheMatches !== settings.cacheMatches) {
		settings.cacheMatches = cacheMatches
		config.set('cacheMatches', settings.cacheMatches)
	}
	const backdrops = (req.query || {}).backdrops || false
	settings.backdrops = backdrops == 1 ? true : false
	config.set('backdrops', settings.backdrops)
	const textless = (req.query || {}).textless || false
	settings.textless = textless == 1 ? true : false
	config.set('textless', settings.textless)
	const scanOrder = (req.query || {}).scanOrder || false
	settings.scanOrder = scanOrder || settings.scanOrder
	config.set('scanOrder', settings.scanOrder)
	res.setHeader('Content-Type', 'application/json')
	res.send({ success: true })	
})

app.get('/getSettings', (req, res) => {
	res.setHeader('Content-Type', 'application/json')
	res.send({
		success: true,
		posterType: settings.posterType,
		overwrite: settings.overwrite,
		overwrite2years: settings.overwriteLast2Years,
		noEmptyFolders: settings.noPostersToEmptyFolders,
		backdrops: settings.backdrops,
		textless: settings.textless,
		minOverwritePeriod: settings.minOverwritePeriod,
		movieFolders: settings.mediaFolders.movie,
		seriesFolders: settings.mediaFolders.series,
		historyCount: Object.keys(settings.imdbCache.movie || []).length + Object.keys(settings.imdbCache.series || []).length,
		apiKeyPrefix: settings.apiKey ? settings.apiKey.substr(0, 3) : false,
		scanOrder: settings.scanOrder,
		cacheMatches: settings.cacheMatches,
	})
})

app.get('/browse', async (req, res) => {
	const folder = (req.query || {}).folder || ''
	res.setHeader('Content-Type', 'application/json')
	res.send({
		success: true,
		folders: await browser(folder)
	})
})

function removeFolderLogic(res, type, folder) {
	if (folder)
		removeMediaFolder(type, folder)
	res.setHeader('Content-Type', 'application/json')
	res.send({ success: true })
}

app.get('/removeMovieFolder', (req, res) => {
	removeFolderLogic(res, 'movie', (req.query || {}).folder || '')
})

app.get('/removeSeriesFolder', (req, res) => {
	removeFolderLogic(res, 'series', (req.query || {}).folder || '')
})

function addFolderLogic(res, type, folder, label) {
	if (folder)
		addMediaFolder(type, folder, label)
	res.setHeader('Content-Type', 'application/json')
	res.send({ success: true })
}

app.get('/addMovieFolder', (req, res) => {
	addFolderLogic(res, 'movie', (req.query || {}).folder || '', (req.query || {}).label || '')
})

app.get('/addSeriesFolder', (req, res) => {
	addFolderLogic(res, 'series', (req.query || {}).folder || '', (req.query || {}).label || '')
})

app.get('/setApiKey', (req, res) => {
	const key = (req.query || {}).key || ''
	res.setHeader('Content-Type', 'application/json')
	if ((key || '').length > 3) {
		settings.apiKey = key
		config.set('apiKey', key)
		res.send({ success: true })
	} else {
		res.send({ success: false })
	}
})

function changePosterForFolder(folder, imdbId, type) {
	return new Promise((resolve, reject) => {
		if (folder && imdbId && type) {
			let mediaFolders = []
			settings.mediaFolders[type].forEach(folders => {
				mediaFolders = mediaFolders.concat(folders)
			})
			if (mediaFolders.length) {
				let allFolders = []
				mediaFolders.forEach(mediaFolder => { allFolders = allFolders.concat(getDirectories(mediaFolder, !!(type == 'movie'))) })

				if (allFolders.length) {
					const simplifiedFolder = folder.trim().toLowerCase()
					let folderMatch
					allFolders.some(fldr => {
						const fldrName = fldr.split(path.sep).pop()
						if (fldrName.trim().toLowerCase() == simplifiedFolder) {
							folderMatch = fldrName
							if (fileHelper.isVideo(fldrName)) {
								const nameNoExt = fileHelper.removeExtension(fldrName)
								nameQueue.unshift({ name: fldrName, folder: path.dirname(fldr), type, forced: true, isFile: true, posterName: nameNoExt + '.jpg', backdropName: nameNoExt + '-fanart.jpg' }) 
							} else {
								nameQueue.unshift({ name: fldrName, folder: fldr, type, forced: true })
							}
							return true
						}
					})
					if (folderMatch) {
						settings.overwriteMatches[type][folderMatch] = imdbId
						config.set('overwriteMatches', settings.overwriteMatches)
						resolve({ success: true })
						return
					}
				}

			}
			resolve({ success: false, message: `The folder could not be found within your ${type} folders` })
			return
		}
		resolve({ success: false, message: `One or more required parameters are missing or invalid` })
	})
}

app.get('/addFixMatch', async(req, res) => {
	const folder = (req.query || {}).folder || ''
	const imdbPart = (req.query || {}).imdb || ''
	const type = (req.query || {}).type || ''
	res.setHeader('Content-Type', 'application/json')
	if (folder.includes(path.sep)) {
		res.send({ success: false, message: `The folder name cannot include "${path.sep}"` })
		return
	}
	let imdbId
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
	if (!imdbId) {
		res.send({ success: false, message: `Invalid IMDB URL / IMDB ID` })
		return
	}
	const respObj = await changePosterForFolder(folder, imdbId, type)
	res.send(respObj)
})

let noSpamScan = false

app.get('/runFullScan', (req, res) => {
	res.setHeader('Content-Type', 'application/json')
	if (noSpamScan) {
		res.send({ success: false, message: `Full scan already running` })
		return
	}
	noSpamScan = true
	setTimeout(() => {
		noSpamScan = false
	}, 5000)
	if (!fullScanRunning) {
		let anyOverwrite = false
		for (const [type, folders] of Object.entries(settings.mediaFolders)) {
			console.log(`Full scan forced to start for ${type} folders`)
			settings.lastFullUpdate[type] = Date.now()
			const overwrite = shouldOverwrite(type)
			if (overwrite) {
				anyOverwrite = true
				settings.lastOverwrite[type] = Date.now()
			}
			startFetchingPosters(folders, type, overwrite)
		}
		config.set('lastFullUpdate', settings.lastFullUpdate)
		if (anyOverwrite)
			config.set('lastOverwrite', settings.lastOverwrite)
		res.send({ success: true })
		return
	}
	res.send({ success: false, message: `Full scan already running` })
})

app.get('/forceOverwriteScan', (req, res) => {
	res.setHeader('Content-Type', 'application/json')
	if (noSpamScan) {
		res.send({ success: false, message: `Full scan already running` })
		return
	}
	noSpamScan = true
	setTimeout(() => {
		noSpamScan = false
	}, 5000)
	for (const [type, folders] of Object.entries(settings.mediaFolders)) {
		console.log(`Overwrite scan forced to start for ${type} folders`)
		settings.lastFullUpdate[type] = Date.now()
		startFetchingPosters(folders, type, true)
	}
	res.send({ success: true })
})

app.get('/pollData', (req, res) => {
	res.setHeader('Content-Type', 'application/json')
	let lastFullUpdate = 0
	if (settings.lastFullUpdate['movie'] > settings.lastFullUpdate['series'])
		lastFullUpdate = settings.lastFullUpdate['movie']
	else
		lastFullUpdate = settings.lastFullUpdate['series']
	res.send({
		success: true,
		lastFullUpdate,
		historyCount: Object.keys(settings.imdbCache.movie || []).length + Object.keys(settings.imdbCache.series || []).length,
		scanItems: nameQueue.length() || 0,
	})
})

const semver = require('semver')

const pkgVersion = require('./package.json').version

app.get('/needsUpdate', (req, res) => {

	res.setHeader('Content-Type', 'application/json')

	const files = new Array()
	const platform = process.platform == 'win32' ? 'win' : process.platform == 'darwin' ? 'osx' : process.platform
	files.push(platform + '-rpdb-folders-' + process.arch + '.zip')
	files.push(platform + '-rpdb-folders.zip')

	let updateRequired = false

	needle.get('https://api.github.com/repos/jaruba/rpdb-folders/releases', (err, resp, body) => {
		if (body && Array.isArray(body) && body.length) {
			const tag = body[0].tag_name
			if (semver.compare(pkgVersion, tag) === -1) {
				updateRequired = true
				if (isDocker()) {
					return
				}
				// update required
				let zipBall
				(body[0].assets || []).some(el => {
					if (files.indexOf(el.name) > -1) {
						zipBall = el.browser_download_url
						return true
					}
				})
				if (updateRequired) {
					if (isDocker()) {
						res.send({ needsUpdate: true, dockerUpdate: true })
						return
					} else if (zipBall) {
						res.send({ needsUpdate: true, zipBall })
						return
					}
				}
			}
		} else {
// we will hide the update check error for now
//			if (err)
//				console.error(err)
		}
		res.send({ needsUpdate: false })
	})
})

app.get('/searchStrings', async (req, res) => {
	function internalError() {
		res.status(500)
		res.send('Internal Server Error')
	}
	const mediaType = req.query.type
	if (!mediaType || !(settings.mediaFolders[mediaType] || []).length) {
		internalError()
		return
	}
	const searchStringsResp = await searchStrings(settings.mediaFolders[mediaType], mediaType)
	res.setHeader('Content-Type', 'application/json')
	res.send(searchStringsResp)	
})

app.get('/poster', (req, res) => {
	function internalError() {
		res.status(500)
		res.send('Internal Server Error')
	}
	const mediaName = req.query.name
	const mediaType = req.query.type
	if (!mediaName || !mediaType) {
		internalError()
		return
	}
	function pipePoster(imdbId) {
		const posterUrl = posterFromImdbId(imdbId)
		needle.get(posterUrl).pipe(res)
	}
	folderNameToImdb(mediaName, mediaType, imdbId => {
		if (imdbId)
			pipePoster(imdbId)
		else
			internalError()
	})
})

app.get('/checkRequests', (req, res) => {
	res.setHeader('Content-Type', 'application/json')
	needle.get('https://api.ratingposterdb.com/' + settings.apiKey + '/requests?break=' + Date.now(), (err, resp, body) => {
		if ((body || {}).limit) {
			body.success = true
			res.send(body)
		} else {
			res.send({ success: false })
		}
	})
})

const ISO6391 = require('iso-639-1')

const tmdbKey = require('./tmdbKey').key

app.get('/poster-choices', (req, res) => {
	function internalError() {
		res.status(500)
		res.send('Internal Server Error')
	}
	const mediaName = req.query.name
	const mediaType = req.query.type
	if (!mediaName || !mediaType) {
		internalError()
		return
	}
	folderNameToImdb(mediaName, mediaType, imdbId => {
		if (imdbId) {
			const tmdbType = mediaType == 'movie' ? mediaType : 'tv'
			needle.get('https://api.themoviedb.org/3/find/'+imdbId+'?api_key='+tmdbKey+'&language=en-US&external_source=imdb_id', (err, resp, body) => {
				if (!err && (resp || {}).statusCode == 200 && (((body || {})[tmdbType + '_results'] || [])[0] || {}).id) {
					const tmdbId = body[tmdbType + '_results'][0].id
					needle.get('https://api.themoviedb.org/3/'+tmdbType+'/'+tmdbId+'/images?api_key='+tmdbKey, (err, resp, body) => {
						if (((body || {}).posters || []).length) {
							res.setHeader('Content-Type', 'application/json')
							res.send({ items: body.posters.map(el => { return { file_path: el.file_path, lang: el['iso_639_1'] ? ISO6391.getName(el['iso_639_1']) : null } }) })
						} else {
							internalError()
						}
					})
				} else {
					internalError()
				}
			})
		} else
			internalError()
	})
})

app.get('/tmdb-poster', (req, res) => {
	function internalError() {
		res.status(500)
		res.send('Internal Server Error')
	}
	const mediaName = req.query.folder
	const mediaType = req.query.type
	const mediaTmdbPoster = req.query.tmdbPoster
	if (!mediaName || !mediaType || !mediaTmdbPoster) {
		internalError()
		return
	}
	folderNameToImdb(mediaName, mediaType, async (imdbId) => {
		if (imdbId) {
			settings.customPosters[imdbId] = 'https://api.ratingposterdb.com/[[api-key]]/imdb/[[poster-type]]/tmdb-poster/[[imdb-id]]/' + mediaTmdbPoster
			config.set('customPosters', settings.customPosters)
			res.setHeader('Content-Type', 'application/json')
			const respObj = await changePosterForFolder(mediaName, imdbId, mediaType)
			res.send(respObj)
		} else
			internalError()
	})
})


app.get('/custom-poster', (req, res) => {
	function internalError() {
		res.status(500)
		res.send('Internal Server Error')
	}
	const mediaName = req.query.folder
	const mediaType = req.query.type
	const mediaCustomPoster = req.query.customPoster
	if (!mediaName || !mediaType || !mediaCustomPoster) {
		internalError()
		return
	}
	folderNameToImdb(mediaName, mediaType, async (imdbId) => {
		if (imdbId) {
			settings.customPosters[imdbId] = 'https://api.ratingposterdb.com/[[api-key]]/imdb/[[poster-type]]/custom-poster/[[imdb-id]].jpg?img=' + encodeURIComponent(mediaCustomPoster)
			config.set('customPosters', settings.customPosters)
			res.setHeader('Content-Type', 'application/json')
			const respObj = await changePosterForFolder(mediaName, imdbId, mediaType)
			res.send(respObj)
		} else
			internalError()
	})
})

let staticPath = path.join(path.dirname(process.execPath), 'static')

if (!fs.existsSync(staticPath))
	staticPath = path.join(__dirname, 'static')

app.use(express.static(staticPath))

let settings = {}

let port

setTimeout(async () => {
	port = await getPort({ port: config.get('port') })
	app.listen(port, async () => {
		settings = config.getAll()
		if (settings.apiKey) {
			await validateApiKey()
		}
		const httpServer = `http://127.0.0.1:${port}/`
		console.log(`RPDB Folders running at: ${httpServer}`)
		try {
			await open(httpServer)
		} catch(e) {}
	})
})
