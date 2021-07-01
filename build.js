const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const ncp = require('ncp').ncp
const { exec } = require('pkg')

const isWin = process.platform === 'win32'

function ext() {
	return (isWin ? '.exe' : '')
}

const platform = process.platform === 'win32' ? 'win' : process.platform == 'darwin' ? 'osx' : 'linux'

const buildFolderName = platform + '-rpdb-folders'

function zipBuildFolder() {

	console.log('Zipping built version')

	const archiver = require('archiver')

	function zipDirectory(source, out) {
	  const archive = archiver('zip', { zlib: { level: 9 }})
	  const stream = fs.createWriteStream(out)

	  return new Promise((resolve, reject) => {
	    archive
	      .directory(source, false)
	      .on('error', err => reject(err))
	      .pipe(stream)

	    stream.on('close', () => resolve())
	    archive.finalize()
	  })
	}

	zipDirectory('./' + buildFolderName, './' + buildFolderName + '.zip').then(() => {
		console.log('Finished all!')
	}).catch(e => {
		console.error(e)
	})
}

function removeUnnecessaryFiles() {
	console.log('Removing Unnecessary Files')
	fs.unlinkSync('./' + buildFolderName + '/package.json')
	try {
		fs.unlinkSync('./' + buildFolderName + '/package-lock.json')
		zipBuildFolder()
	} catch(e) {
		console.log('NPM builds failed, copying builds from node_modules folder')
		let builds = ['drivelist/build']
		function copyBuilds() {
			if (builds.length) {
				const moduleBuildFolder = builds.shift()
				ncp('./node_modules/' + moduleBuildFolder, './' + buildFolderName + '/node_modules/' + moduleBuildFolder, function (err) {
					if (err)
						return console.error(err)
					copyBuilds()
				})
			} else
				zipBuildFolder()
		}
		copyBuilds()
	}
}

function copyStaticFolder() {
	console.log('Moving Static Folder')
	ncp('./static', './' + buildFolderName + '/static', function (err) {
		if (err)
			return console.error(err)
		console.log('Finished!')
		removeUnnecessaryFiles()
	})
}

function createExternalPackageJSON() {
	console.log('Creating package.json for External Modules')
	fs.writeFileSync('./' + buildFolderName + '/package.json', '{\n  "name": "rpdb-folders",\n  "version": "0.0.1",\n  "dependencies": {\n    "drivelist": "9.2.4"\n  }\n}')
	console.log('Finished!')
	installExternalModules()
}

function installExternalModules() {
	const spawn = require('child_process').spawn

	console.log('Installing External Modules')

	function cb() {
		copyStaticFolder()
	}

	spawn('npm' + (isWin ? '.cmd' : ''), ['i'], {
		cwd: path.join(__dirname, buildFolderName),
		env: Object.create(process.env)
	}).on('exit', cb)
}

function packageApp() {

	console.log('Start - Packaging App to Executable')

	exec(['package.json', '--target', 'host', '--output', './' + buildFolderName + '/rpdb-folders' + ext()]).then(() => {

		console.log('Finished!')

		createExternalPackageJSON()

	}).catch(err => {
		if (err)
			console.error(err)
		console.log('Finished!')
	})

}

function removeOldBuild() {

	console.log('Removing Old Build Items')

	let buildItems = [buildFolderName, buildFolderName + '.zip']

	function removeBuildItems() {
		if (buildItems.length) {
			const buildItem = buildItems.shift()
			if (fs.existsSync('./' + buildItem)) {
				rimraf(path.join(__dirname, buildItem), () => {
					removeBuildItems()
				})
			} else
				removeBuildItems()
		} else {
			console.log('Finished!')
			packageApp()
		}
	}

	removeBuildItems()

}

function verifyTmdbKey() {
	if (!require('./tmdbKey').key) {
		if (!tmdbKey) {
			console.log('Missing TMDB Key!')
			process.exit()
		} else {
			fs.writeFileSync('./tmdbKey.js', "module.exports = { key: '" + tmdbKey + "' }")
			removeOldBuild()
		}
	} else {
		removeOldBuild()
	}
}

let tmdbKey

process.argv.forEach(el => {
	console.log(el)
	if (el.startsWith('--tmdb=')) {
		tmdbKey = el.replace('--tmdb=', '')
		if (tmdbKey.includes('"') || tmdbKey.includes("'"))
			tmdbKey = tmdbKey.replace(/['"]+/g, '')
	}
})

console.log('key', tmdbKey)

verifyTmdbKey()
