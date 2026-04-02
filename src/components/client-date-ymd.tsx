'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { formatDateTimeLocalAmPm } from '@/lib/format-date';

const PLACEHOLDER = '—';

export function useClientDateYmd(iso: string): string {
	const [label, setLabel] = useState(PLACEHOLDER);
	useEffect(() => {
		setLabel(formatDateTimeLocalAmPm(new Date(iso)));
	}, [iso]);
	return label;
}

/** Local `YYYY-MM-DD hh:mm:ss AM` + short TZ after mount; placeholder until then (avoids hydration mismatch). */
export function ClientDateYmd({ iso, className }: { iso: string; className?: string }): ReactNode {
	const label = useClientDateYmd(iso);
	return <span className={className}>{label}</span>;
}
