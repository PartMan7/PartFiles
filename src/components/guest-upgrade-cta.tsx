'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type Phase = 'loading' | 'pending' | 'ready';

/**
 * Guest dashboard CTA: checks upgrade-request status in a client fetch after paint.
 */
export function GuestUpgradeCta() {
	const [phase, setPhase] = useState<Phase>('loading');

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch('/api/account/upgrade-request');
				if (cancelled) return;
				if (!res.ok) {
					setPhase('ready');
					return;
				}
				const data = (await res.json()) as { status?: string };
				if (data.status === 'pending') {
					setPhase('pending');
				} else {
					setPhase('ready');
				}
			} catch {
				if (!cancelled) setPhase('ready');
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	if (phase === 'loading') {
		return (
			<Button size="lg" className="w-full gap-2 sm:w-auto sm:min-w-50" disabled aria-busy="true" aria-label="Checking upgrade status">
				<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
				Loading…
			</Button>
		);
	}

	if (phase === 'pending') {
		return (
			<Button size="lg" className="w-full sm:w-auto" disabled>
				Upgrade requested
			</Button>
		);
	}

	return (
		<Link href="/request-upgrade" className="shrink-0">
			<Button size="lg" className="w-full sm:w-auto">
				Request an upgrade
			</Button>
		</Link>
	);
}
