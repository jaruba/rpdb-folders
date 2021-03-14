
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

	if (!folder) {
		const drives = await drivelist.list()

		if (drives.length) {
			let mountpoints = []
			drives.forEach(el => {
				if ((el.mountpoints || []).length)
					el.mountpoints.forEach(mount => {
						const found = mountpoints.some(el => {
							if (el.path == mount.path)
								return true
						})
						if (!found)
							mountpoints.push(mount)
					})
			})

			let networkDrives

			if (winNetDrive.isWinOs())
				try {
					const netDrivesList = await winNetDrive.list()
					networkDrives = Object.keys(netDrivesList || {}).map(el => { return { path: el + ':\\' } })
				} catch(e) {}

			mountpoints = mountpoints.concat(networkDrives || [])

			return mountpoints
		} else {
			return []
		}
	} else {
		return getDirectories(folder).map(el => {
			const label = el.split(fs.sep).pop()
			if (label.startsWith('.'))
				return null
			return { path: el, label: el.split(fs.sep).pop() }
		}).filter(el => !!el)
	}
}
