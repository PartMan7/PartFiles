'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { formatDateTimeLocalAmPm } from '@/lib/format-date';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const PLACEHOLDER = '—';

export function useClientDateYmd(iso: string): string {
	const [label, setLabel] = useState(PLACEHOLDER);
	useEffect(() => {
		setLabel(formatDateTimeLocalAmPm(new Date(iso)));
	}, [iso]);
	return label;
}

/** Short local date after mount, full stamp in tooltip on hover/focus; placeholder until mount (avoids hydration mismatch). */
export function ClientDateYmd({ iso, className }: { iso: string; className?: string }): ReactNode {
	const full = useClientDateYmd(iso);
	const d = new Date(iso);
	const short =
		full === PLACEHOLDER
			? PLACEHOLDER
			: `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${String(d.getFullYear())}, ${d.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit' })}`;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span tabIndex={0} className={className}>
					{short}
				</span>
			</TooltipTrigger>
			<TooltipContent>{full}</TooltipContent>
		</Tooltip>
	);
}
