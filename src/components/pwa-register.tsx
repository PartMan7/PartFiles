'use client';

import { useEffect } from 'react';

export function PwaRegister() {
	useEffect(() => {
		if (process.env.NODE_ENV !== 'production') return;
		if (!('serviceWorker' in navigator)) return;

		navigator.serviceWorker.register('/sw.js').catch(() => {
			// Registration failed — app still works without offline support.
		});
	}, []);

	return null;
}
