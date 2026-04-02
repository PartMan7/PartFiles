/** Local wall time as `YYYY-MM-DD hh:mm:ss AM TZ` (12-hour, seconds, padded hour 01–12, short TZ name). */
export function formatDateTimeLocalAmPm(d: Date): string {
	const y = d.getFullYear();
	const mo = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');

	const h24 = d.getHours();
	const ampm = h24 >= 12 ? 'PM' : 'AM';
	let h12 = h24 % 12;
	if (h12 === 0) h12 = 12;
	const hh = String(h12).padStart(2, '0');

	const min = String(d.getMinutes()).padStart(2, '0');
	const sec = String(d.getSeconds()).padStart(2, '0');

	const tz =
		new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(d).find(p => p.type === 'timeZoneName')?.value ?? '';

	const base = `${y}-${mo}-${day} ${hh}:${min}:${sec} ${ampm}`;
	return tz ? `${base} ${tz}` : base;
}
