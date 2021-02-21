
const express = require('express')
const app = express()
const nameToImdb = require('name-to-imdb')
const needle = require('needle')
const async = require('async')
const chokidar = require('chokidar')
const fs = require('fs')
const path = require('path')
const tnp = require('torrent-name-parser')
const open = require('open')
const getPort = require('get-port')
const config = require('./config')
const browser = require('./browser')

const tryThreeTimes = {}

const nameQueue = async.queue((task, cb) => {
	console.log('Posters left in queue: ' + nameQueue.length())

	const posterExists = fs.existsSync(path.join(task.folder, 'poster.jpg'))

	let backdropExists = false

	if (settings.backdrops) {
		backdropExists = fs.existsSync(path.join(task.folder, 'background.jpg'))
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
		const posterUrl = 'https://api.ratingposterdb.com/' + settings.apiKey + '/imdb/' + settings.posterType + '/' + imdbId + '.jpg'
		needle.get(posterUrl, (err, res) => {
			if (!err && res.statusCode == 200) {
				fs.writeFile(path.join(task.folder, 'poster.jpg'), res.raw, (err) => {
					if (err) {
						if (!tryThreeTimes.hasOwnObject(task.name))
							tryThreeTimes[task.name] = 0
						if (tryThreeTimes[task.name] < 3) {
							tryThreeTimes[task.name]++
							console.log(`Warning: Could not download poster for ${task.name}, trying again in 4h`)
							setTimeout(() => {
								nameQueue.push(task)
							}, 4 * 60 * 60 * 1000)
						} else {
							delete tryThreeTimes[task.name]
							console.log(`Warning: Could not download poster for ${task.name}, tried 3 times`)
						}
					} else
						console.log(`Poster for ${task.name} downloaded`)
					endIt()
				})
			} else {
				endIt()
			}
		})
	}

	function getBackdrop(imdbId) {
		if (backdropExists && !task.forced) {
			endIt()
			return
		}
		const posterUrl = 'https://api.ratingposterdb.com/' + settings.apiKey + '/imdb/backdrop-default/' + imdbId + '.jpg'
		needle.get(posterUrl, (err, res) => {
			if (!err && res.statusCode == 200) {
				fs.writeFile(path.join(task.folder, 'background.jpg'), res.raw, (err) => {
					if (err) {
						console.log(`Warning: Could not download backdrop for ${task.name}, trying again in 4h`)
					} else
						console.log(`Backdrop for ${task.name} downloaded`)
					endIt()
				})
			} else {
				endIt()
			}
		})
	}

	let imdbId

	if (settings.overwriteMatches[task.type][task.name])
		imdbId = settings.overwriteMatches[task.type][task.name]

	if (!imdbId && settings.imdbCache[task.type][task.name])
		imdbId = settings.imdbCache[task.type][task.name]

	if (imdbId) {
		getPoster(imdbId)
		if (settings.backdrops)
			getBackdrop(imdbId)
		return
	}

	const obj = { type: task.type, providers: ['imdbFind'] }

	// it's important to use these regex matches separate:

	// ends with year in parantheses:

	const yearMatch1 = task.name.match(/ \((\d{4}|\d{4}\-\d{4})\)$/)

	if ((yearMatch1 || []).length > 1) {
		obj.year = yearMatch1[1]
		obj.name = task.name.replace(/ \((\d{4}|\d{4}\-\d{4})\)$/, '')
	} else {

		// ends with year without parantheses:

		const yearMatch2 = task.name.match(/ (\d{4}|\d{4}\-\d{4})$/)
		if ((yearMatch2 || []).length > 1) {
			obj.year = yearMatch2[1]
			obj.name = task.name.replace(/ (\d{4}|\d{4}\-\d{4})$/, '')
		} else {

			const tnpParsed = tnp(task.name)

			if (tnpParsed.title) {
				obj.name = tnpParsed.title
				if (tnpParsed.year)
					obj.year = tnpParsed.year
			}

		}
	}

	if (!obj.name)
		obj.name = task.name.toLowerCase()
	else
		obj.name = obj.name.toLowerCase()

	// "Marvel's ..." can be a special case...
	if (obj.type == 'series' && obj.name.startsWith('marvel'))
		obj.name = obj.name.replace(/^marvel ?'?s /,'')

	nameToImdb(obj, (err, res, inf) => {
		if ((res || '').startsWith('tt')) {
			settings.imdbCache[task.type][task.name] = res
			getPoster(res)
			if (settings.backdrops)
				getBackdrop(imdbId)
		} else {
			endIt()
			if (settings.backdrops) // end again
				endIt()
		}
	})
}, 1)

nameQueue.drain(() => {
	config.set('imdbCache', settings.imdbCache)
	fullScanRunning = false
})

const isDirectory = source => fs.lstatSync(source).isDirectory()
const getDirectories = source => fs.readdirSync(source).map(name => path.join(source, name)).filter(isDirectory)

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

function fullUpdate() {
	for (const [type, folders] of Object.entries(settings.mediaFolders)) {
		if (settings.lastFullUpdate[type] < Date.now() - settings.fullUpdate) {
			console.log(`Initiating periodic update of all ${type} folders`)
			settings.lastFullUpdate[type] = Date.now()
			startFetchingPosters(folders, type, !!settings.overwrite)
		}
	}
	config.set('lastFullUpdate', settings.lastFullUpdate)
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

function addMediaFolder(type, folder) {
	const idx = settings.mediaFolders[type].indexOf(folder)
	if (idx == -1) {
		settings.mediaFolders[type].push(folder)
		config.set('mediaFolders', settings.mediaFolders)
		addToWatcher([folder])
	}
}

function removeMediaFolder(type, folder) {
	const idx = settings.mediaFolders[type].indexOf(folder)
	if (idx !== -1) {
		settings.mediaFolders[type].splice(idx, 1)
		config.set('mediaFolders', settings.mediaFolders)
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
			if (!err && resp.statusCode == 200) {
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
	const overwrite = (req.query || {}).overwrite || false
	settings.overwrite = overwrite == 1 ? true : false
	config.set('overwrite', settings.overwrite)
	const backdrops = (req.query || {}).backdrops || false
	settings.backdrops = backdrops == 1 ? true : false
	config.set('backdrops', settings.backdrops)
	res.setHeader('Content-Type', 'application/json')
	res.send({ success: true })	
})

app.get('/getSettings', (req, res) => {
	res.setHeader('Content-Type', 'application/json')
	res.send({
		success: true,
		posterType: settings.posterType,
		overwrite: settings.overwrite,
		backdrops: settings.backdrops,
		movieFolders: settings.mediaFolders.movie,
		seriesFolders: settings.mediaFolders.series,
		historyCount: Object.keys(settings.imdbCache.movie || []).length + Object.keys(settings.imdbCache.series || []).length,
		apiKeyPrefix: settings.apiKey ? settings.apiKey.substr(0, 3) : false,
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

function addFolderLogic(res, type, folder) {
	if (folder)
		addMediaFolder(type, folder)
	res.setHeader('Content-Type', 'application/json')
	res.send({ success: true })
}

app.get('/addMovieFolder', (req, res) => {
	addFolderLogic(res, 'movie', (req.query || {}).folder || '')
})

app.get('/addSeriesFolder', (req, res) => {
	addFolderLogic(res, 'series', (req.query || {}).folder || '')
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

app.get('/addFixMatch', (req, res) => {
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
	if (folder && imdbId && type) {
		let mediaFolders = []
		settings.mediaFolders[type].forEach(folders => {
			mediaFolders = mediaFolders.concat(folders)
		})
		if (mediaFolders.length) {
			let allFolders = []
			mediaFolders.forEach(mediaFolder => { allFolders = allFolders.concat(getDirectories(mediaFolder)) })

			if (allFolders.length) {
				const simplifiedFolder = folder.trim().toLowerCase()
				let folderMatch
				allFolders.some(fldr => {
					const fldrName = fldr.split(path.sep).pop()
					if (fldrName.trim().toLowerCase() == simplifiedFolder) {
						folderMatch = fldrName
						nameQueue.push({ name: fldrName, folder: fldr, type, forced: true })
						return true
					}
				})
				if (folderMatch) {
					settings.overwriteMatches[type][folderMatch] = imdbId
					config.set('overwriteMatches', settings.overwriteMatches)
					res.send({ success: true })
					return
				}
			}

		}
		res.send({ success: false, message: `The folder could not be found within your ${type} folders` })
		return
	}
	res.send({ success: false, message: `One or more required parameters are missing or invalid` })
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
		for (const [type, folders] of Object.entries(settings.mediaFolders)) {
			console.log(`Full scan forced to start for ${type} folders`)
			settings.lastFullUpdate[type] = Date.now()
			startFetchingPosters(folders, type, !!settings.overwrite)
		}
		config.set('lastFullUpdate', settings.lastFullUpdate)
		res.send({ success: true })
		return
	}
	res.send({ success: false, message: `Full scan already running` })
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
	})
})

app.use(express.static(path.join(path.dirname(process.execPath), 'static')))

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
