window.ASSET_URL = new URL("https://apievrymatrix5d84k321.com");
window.toAssetUrl = (path) => {
	const cleanPath = path.startsWith('/') ? path.slice(1) : path;
	return new URL(cleanPath, window.ASSET_URL).toString();
};