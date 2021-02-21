const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const ncp = require('ncp').ncp
const { exec } = require('pkg')

const isWin = process.platform === 'win32'

function ext() {
	return (isWin ? '.exe' : '')
}

function removeUnnecessaryFiles() {
	console.log('Removing Unnecessary Files')
	fs.unlinkSync('./build/package.json')
	fs.unlinkSync('./build/package-lock.json')
	console.log('Finished all!')
}

function copyStaticFolder() {
	console.log('Moving Static Folder')
	ncp('./static', './build/static', function (err) {
		if (err)
			return console.error(err)
		console.log('Finished!')
		removeUnnecessaryFiles()
	})
}

function createExternalPackageJSON() {
	console.log('Creating package.json for External Modules')
	fs.writeFileSync('./build/package.json', '{\n  "name": "rpdb-folders",\n  "version": "0.0.1",\n  "dependencies": {\n    "drivelist": "9.2.4"\n  }\n}')
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
		cwd: path.join(__dirname, 'build'),
		env: Object.create(process.env)
	}).on('exit', cb)
}

function packageApp() {

	console.log('Start - Packaging App to Executable')

	exec(['package.json', '--target', 'host', '--output', './build/rpdb-folders' + ext()]).then(() => {

		console.log('Finished!')

		createExternalPackageJSON()

	}).catch(err => {
		if (err)
			console.error(err)
		console.log('Finished!')
	})

}

function removeOldBuild() {
	if (fs.existsSync('./build')) {
		console.log('Removing Old Build')
		rimraf(path.join(__dirname, 'build'), () => {
			console.log('Finished!')
			packageApp()
		})
	} else {
		packageApp()
	}
}

removeOldBuild()

