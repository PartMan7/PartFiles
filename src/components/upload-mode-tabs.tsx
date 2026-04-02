'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UploadForm } from '@/components/upload-form';
import { AdminUploadForm } from '@/components/admin-upload-form';
import { type UploadMode, persistUploadMode, readStoredUploadMode } from '@/lib/upload-mode-preference';

export type { UploadMode };

type UploadModeTabsProps = {
	isAdmin: boolean;
	initialMode: UploadMode;
	/** True when the URL explicitly requests Quick Share (`?tab=share`). Overrides localStorage. */
	tabFromUrl: boolean;
};

export function UploadModeTabs({ isAdmin, initialMode, tabFromUrl }: UploadModeTabsProps) {
	const router = useRouter();
	const [mode, setMode] = useState<UploadMode>(initialMode);

	useEffect(() => {
		if (tabFromUrl) {
			setMode(initialMode);
			return;
		}
		const saved = readStoredUploadMode();
		const next = saved ?? initialMode;
		setMode(next);
		const wantShare = next === 'share';
		const urlHasShare = new URLSearchParams(window.location.search).get('tab') === 'share';
		if (wantShare !== urlHasShare) {
			router.replace(wantShare ? '/upload?tab=share' : '/upload', { scroll: false });
		}
	}, [tabFromUrl, initialMode, router]);

	return (
		<Tabs
			value={mode}
			onValueChange={v => {
				const next = v as UploadMode;
				setMode(next);
				persistUploadMode(next);
				if (next === 'share') {
					router.replace('/upload?tab=share', { scroll: false });
				} else {
					router.replace('/upload', { scroll: false });
				}
			}}
			className="w-full"
		>
			<div className="mb-6 flex w-full justify-center">
				<TabsList className="grid h-11 w-full max-w-md grid-cols-2 gap-0.5 p-1">
					<TabsTrigger
						value="share"
						className="cursor-pointer px-4 text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
					>
						Share Files
					</TabsTrigger>
					<TabsTrigger
						value="store"
						className="cursor-pointer px-4 text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
					>
						Store Files
					</TabsTrigger>
				</TabsList>
			</div>
			<TabsContent value="share" className="mt-0">
				<h1 className="text-3xl font-bold mb-2">Quick Share</h1>
				<p className="text-muted-foreground text-sm mb-6">
					Upload with a 1-hour default expiry. Content URLs are copied automatically after upload.
				</p>
				<UploadForm isAdmin={isAdmin} defaultExpiry="1" autoCopyRawUrl submitOnPaste />
			</TabsContent>
			<TabsContent value="store" className="mt-0">
				<h1 className="text-3xl font-bold mb-6">Upload Content</h1>
				{isAdmin ? <AdminUploadForm /> : <UploadForm isAdmin={false} />}
			</TabsContent>
		</Tabs>
	);
}
