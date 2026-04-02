'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type StatusResponse = { status: 'none' } | { status: 'pending'; pendingUntil: string } | { status: 'eligible' };

const MAX_LEN = 200;

export function RequestUpgradeForm() {
	const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
	const [data, setData] = useState<StatusResponse | null>(null);
	const [justification, setJustification] = useState('');
	const [submitError, setSubmitError] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const refresh = useCallback(async () => {
		setLoadState('loading');
		try {
			const res = await fetch('/api/account/upgrade-request');
			const json = (await res.json()) as StatusResponse & { error?: string };
			if (!res.ok) {
				setLoadState('error');
				return;
			}
			setData(json as StatusResponse);
			setLoadState('ok');
		} catch {
			setLoadState('error');
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSubmitError('');
		setSubmitting(true);
		try {
			const res = await fetch('/api/account/upgrade-request', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ justification: justification.trim() }),
			});
			const json = (await res.json()) as { error?: string; pendingUntil?: string };
			if (!res.ok) {
				setSubmitError(json.error || 'Request failed');
				setSubmitting(false);
				return;
			}
			setJustification('');
			await refresh();
		} catch {
			setSubmitError('Network error');
		} finally {
			setSubmitting(false);
		}
	}

	if (loadState === 'loading') {
		return <p className="text-muted-foreground">Loading…</p>;
	}

	if (loadState === 'error' || !data) {
		return <p className="text-destructive">Could not load request status.</p>;
	}

	if (data.status === 'pending') {
		return (
			<Alert>
				<AlertDescription>Your request is under consideration.</AlertDescription>
			</Alert>
		);
	}

	const canSubmit = data.status === 'none' || data.status === 'eligible';

	return (
		<Card className="border-primary/20">
			<CardHeader>
				<CardTitle>Request an upgrade</CardTitle>
				<CardDescription>If you need more than guest storage, send a short note and we will review it.</CardDescription>
			</CardHeader>
			<CardContent>
				{canSubmit ? (
					<form onSubmit={handleSubmit} className="space-y-4">
						{submitError && (
							<Alert variant="destructive">
								<AlertDescription>{submitError}</AlertDescription>
							</Alert>
						)}
						<div className="space-y-2">
							<Label htmlFor="justification">Message</Label>
							<textarea
								id="justification"
								value={justification}
								onChange={e => setJustification(e.target.value.slice(0, MAX_LEN))}
								placeholder="What would help?"
								rows={4}
								maxLength={MAX_LEN}
								required
								aria-describedby="justification-counter"
								className={cn(
									'placeholder:text-muted-foreground dark:bg-input/30 border-input min-h-[100px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:opacity-50 md:text-sm',
									'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
								)}
							/>
							<p id="justification-counter" className="text-xs text-muted-foreground text-right">
								{justification.length} / {MAX_LEN}
							</p>
						</div>
						<Button type="submit" disabled={submitting || !justification.trim()}>
							{submitting ? 'Sending…' : 'Send'}
						</Button>
					</form>
				) : null}
			</CardContent>
		</Card>
	);
}
