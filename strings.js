
const specialSpaces = ['.','-','_']

const specialSpacesAtEnd = new RegExp('[' + specialSpaces.join('') + ']$')

module.exports = {
	shouldNotParseName: folderName => {
		folderName = folderName || ''
		const countSpaces = folderName.split(' ').length-1
		const specialChars = []
		specialSpaces.forEach(el => { specialChars.push(folderName.split(el).length -1) })
		return !specialChars.some(el => { return !!(el > countSpaces) })
	},
	cleanFolderName: folderName => {

		folderName = folderName || ''

		// remove any data within curly brackets (including brackets, this causes a JSON parse error otherwise)
		// example folder name: "1917_(2019)_{tmdb-530915}"

		folderName = folderName.replace(/\s?\{[^}]+\}/,'')

		// remove any data larger than 4 characters within brackets at the end of a string (larger than 4 to avoid removing years)
		// example folder name: "Hokuto no Ken (1986) [anidb-211]"

		folderName = folderName.replace(/\s?\[[^\]]{5,99}\]$/, '')

		// remove unwanted characters from end of string: "-"; "_"; "."

		folderName = folderName.replace(specialSpacesAtEnd, '')

		return folderName.trim()

	},
	sanitizeName: name => {
		return name.replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase().replace('the ','')
	},
}
