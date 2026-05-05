/** Build a `File` for multipart upload as plain text (.txt). */
export function buildTextUploadFile(body: string, filenameBase: string): File {
	const trimmedName = filenameBase.trim();
	const base = trimmedName || 'upload';
	const withExt = /\.txt$/i.test(base) ? base : `${base}.txt`;
	return new File([body], withExt, { type: 'text/plain' });
}
