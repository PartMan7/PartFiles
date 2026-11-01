'use client';

import { Button } from '@/components/ui/button';

export default function OfflinePage() {
	return (
		<main id="main-content" className="flex flex-col items-center justify-center gap-4 min-h-[calc(100vh-200px)] px-4 text-center">
			<h1 className="text-2xl font-semibold text-primary">You&apos;re offline</h1>
			<p className="text-muted-foreground max-w-md">PartFiles needs a network connection. Check your connection and try again.</p>
			<Button type="button" onClick={() => window.location.reload()}>
				Reload
			</Button>
		</main>
	);
}
