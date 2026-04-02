'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type LastUploadContextValue = {
	lastRawUrls: string[];
	setLastRawUrls: (urls: string[]) => void;
	/** Full `/c/{id}` URLs from the most recent upload (batch = multiple lines). */
	lastUploadedContentUrls: string[];
	setLastUploadedContentUrls: (urls: string[]) => void;
};

const LastUploadContext = createContext<LastUploadContextValue | null>(null);

export function LastUploadProvider({ children }: { children: ReactNode }) {
	const [lastRawUrls, setLastRawUrlsState] = useState<string[]>([]);
	const [lastUploadedContentUrls, setLastUploadedContentUrlsState] = useState<string[]>([]);

	const setLastRawUrls = useCallback((urls: string[]) => {
		setLastRawUrlsState(urls);
	}, []);

	const setLastUploadedContentUrls = useCallback((urls: string[]) => {
		setLastUploadedContentUrlsState(urls);
	}, []);

	const value = useMemo(
		() => ({ lastRawUrls, setLastRawUrls, lastUploadedContentUrls, setLastUploadedContentUrls }),
		[lastRawUrls, setLastRawUrls, lastUploadedContentUrls, setLastUploadedContentUrls]
	);

	return <LastUploadContext.Provider value={value}>{children}</LastUploadContext.Provider>;
}

export function useLastUpload(): LastUploadContextValue {
	const ctx = useContext(LastUploadContext);
	if (!ctx) {
		throw new Error('useLastUpload must be used within LastUploadProvider');
	}
	return ctx;
}
