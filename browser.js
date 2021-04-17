
const fileHelper = require('./files')

const extRequire = require('./externalRequire')

const drivelist = extRequire('drivelist')

const isDocker = require('is-docker')

const fs = require('fs')
const path = require('path')

const isDirectoryOrVideo = (withVideos, source) => { try { return fs.lstatSync(source).isDirectory() || (withVideos && fileHelper.isVideo(source)) } catch(e) { return false } }
const getDirectories = (source, withVideos) => fs.readdirSync(source).map(name => path.join(source, name)).filter(isDirectoryOrVideo.bind(null, withVideos))

const winNetDrive = require('windows-network-drive')

module.exports = async (folder, withVideos) => {

	if (!folder && isDocker())
		folder = '/rpdb/mounts'

	if (folder) return getDirectories(folder, withVideos).map(path => {
		const label = path.split(fs.sep).pop()
		if (label.startsWith('.'))
			return null
		return { path, label }
	}).filter(el => !!el)

	const drives = await drivelist.list()

	let mountpoints = []
	drives.forEach(el => {
		(el.mountpoints || []).forEach(mount => {
			if (!mountpoints.some(el => el.path == mount.path))
				mountpoints.push(mount)
		})
	})

	if (winNetDrive.isWinOs())
		try {
			const netDrivesList = await winNetDrive.list()
			const networkDrives = Object.keys(netDrivesList || {}).map(el => { return { path: el + ':\\' } })
			mountpoints = mountpoints.concat(networkDrives)
		} catch(e) {}

	return mountpoints
}
