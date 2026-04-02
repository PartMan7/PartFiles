'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type ContentPageCopyInfo = {
	contentId: string;
	shortSlugs: string[];
	contentBaseUrl: string;
};

type ContentPageCopyContextValue = {
	info: ContentPageCopyInfo | null;
	setInfo: (value: ContentPageCopyInfo | null) => void;
};

const ContentPageCopyContext = createContext<ContentPageCopyContextValue | null>(null);

export function ContentPageCopyProvider({ children }: { children: ReactNode }) {
	const [info, setInfo] = useState<ContentPageCopyInfo | null>(null);
	const value = useMemo(() => ({ info, setInfo }), [info]);
	return <ContentPageCopyContext.Provider value={value}>{children}</ContentPageCopyContext.Provider>;
}

export function useContentPageCopyInfo(): ContentPageCopyInfo | null {
	return useContext(ContentPageCopyContext)?.info ?? null;
}

export function useSetContentPageCopyInfo(): (value: ContentPageCopyInfo | null) => void {
	const ctx = useContext(ContentPageCopyContext);
	if (!ctx) {
		throw new Error('useSetContentPageCopyInfo must be used within ContentPageCopyProvider');
	}
	return ctx.setInfo;
}
