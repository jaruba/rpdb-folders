const videoTypes = ['.mkv', '.avi', '.mp4']

module.exports = {
	isVideo: file => videoTypes.some(el => file.endsWith(el)),
	removeExtension: file => file.replace(new RegExp('\.' + file.split('.').pop() + '$'), ''),
}
