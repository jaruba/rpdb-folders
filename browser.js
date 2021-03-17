
const extRequire = require('./externalRequire')

const drivelist = extRequire('drivelist')

const isDocker = require('is-docker')

const fs = require('fs')
const path = require('path')

const isDirectory = source => { try { return fs.lstatSync(source).isDirectory() } catch(e) { return false } }
const getDirectories = source => fs.readdirSync(source).map(name => path.join(source, name)).filter(isDirectory)

const winNetDrive = require('windows-network-drive')

module.exports = async (folder) => {

	if (!folder && isDocker())
		folder = '/rpdb/mounts'

	if (folder) return getDirectories(folder).map(path => {
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
