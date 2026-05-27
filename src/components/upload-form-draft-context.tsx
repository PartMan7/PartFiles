'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type UploadMethod = 'files' | 'rawText';

export type UploadFormDraft = {
	uploadMethod: UploadMethod;
	selectedFiles: File[];
	rawText: string;
	filename: string;
};

const emptyDraft = (): UploadFormDraft => ({
	uploadMethod: 'files',
	selectedFiles: [],
	rawText: '',
	filename: '',
});

type SharedDraft = {
	draft: UploadFormDraft;
	setDraft: React.Dispatch<React.SetStateAction<UploadFormDraft>>;
};

const UploadFormDraftContext = createContext<SharedDraft | null>(null);

export function UploadFormDraftProvider({ children }: { children: ReactNode }) {
	const [draft, setDraft] = useState(emptyDraft);
	const value = useMemo(() => ({ draft, setDraft }), [draft]);
	return <UploadFormDraftContext.Provider value={value}>{children}</UploadFormDraftContext.Provider>;
}

export function useUploadFormDraft() {
	const shared = useContext(UploadFormDraftContext);
	const [localDraft, setLocalDraft] = useState(emptyDraft);
	const draft = shared?.draft ?? localDraft;
	const setDraft = shared?.setDraft ?? setLocalDraft;

	const updateDraft = useCallback(
		(patch: Partial<UploadFormDraft>) => {
			setDraft(prev => ({ ...prev, ...patch }));
		},
		[setDraft]
	);

	return { draft, updateDraft, isShared: shared !== null };
}
