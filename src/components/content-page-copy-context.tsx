'use client';

import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react';

export type ContentPageCopyInfo = {
	contentId: string;
	shortSlugs: string[];
	contentBaseUrl: string;
};

type SetContentPageCopyInfo = (
	value: ContentPageCopyInfo | null | ((prev: ContentPageCopyInfo | null) => ContentPageCopyInfo | null)
) => void;

type ContentPageCopyContextValue = {
	info: ContentPageCopyInfo | null;
	setInfo: SetContentPageCopyInfo;
};

const ContentPageCopyContext = createContext<ContentPageCopyContextValue | null>(null);

export function ContentPageCopyProvider({ children }: { children: ReactNode }) {
	const [info, setInfoState] = useState<ContentPageCopyInfo | null>(null);
	const setInfo = useCallback<SetContentPageCopyInfo>(value => {
		setInfoState(prev => (typeof value === 'function' ? value(prev) : value));
	}, []);
	const value = useMemo(() => ({ info, setInfo }), [info, setInfo]);
	return <ContentPageCopyContext.Provider value={value}>{children}</ContentPageCopyContext.Provider>;
}

export function useContentPageCopyInfo(): ContentPageCopyInfo | null {
	return useContext(ContentPageCopyContext)?.info ?? null;
}

export function useSetContentPageCopyInfo(): SetContentPageCopyInfo {
	const ctx = useContext(ContentPageCopyContext);
	if (!ctx) {
		throw new Error('useSetContentPageCopyInfo must be used within ContentPageCopyProvider');
	}
	return ctx.setInfo;
}
