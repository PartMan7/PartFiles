'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TokenReveal } from '@/components/token-reveal';
import { expiryLabel } from '@/components/token-manager';
import { MAX_TOKEN_NAME_LENGTH, SCOPE_INFO, type TokenScope } from '@/lib/token-scopes';

interface Props {
	scopes: TokenScope[];
	days: number | null;
	callbackUrl: string | null;
	defaultName: string;
}

export function GenerateTokenForm({ scopes, days, callbackUrl, defaultName }: Props) {
	const [name, setName] = useState(defaultName);
	const [trusted, setTrusted] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [token, setToken] = useState<string | null>(null);

	const callbackHost = callbackUrl ? new URL(callbackUrl).host : null;

	async function handleGenerate() {
		setSubmitting(true);
		try {
			const res = await fetch('/api/tokens', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, scopes, expiresInDays: days }),
			});
			const data = await res.json();
			if (!res.ok) {
				toast.error(data.error || 'Failed to create token');
				return;
			}
			if (callbackUrl) {
				// Fragment is never sent to servers or logged.
				const target = new URL(callbackUrl);
				target.hash = `token=${encodeURIComponent(data.token)}`;
				window.location.assign(target.toString());
				return;
			}
			setToken(data.token);
		} catch {
			toast.error('Failed to create token');
		} finally {
			setSubmitting(false);
		}
	}

	if (token) return <TokenReveal token={token} onDismiss={() => setToken(null)} />;

	return (
		<div className="space-y-6">
			<Alert variant="destructive">
				<AlertDescription className="space-y-2">
					<p className="font-semibold">
						You are generating a token with <span className="font-mono">{scopes.join(', ')}</span> scopes which expires{' '}
						{days === null ? 'never' : `in ${expiryLabel(days)}`}.
						{callbackUrl ? ` After this, you will be redirected to ${callbackHost}.` : ' The token will be shown once on this page.'}{' '}
						Do NOT continue unless you trust this source.
					</p>
					<ul className="list-disc pl-5 text-sm">
						{scopes.map(s => (
							<li key={s}>
								<span className="font-mono">{s}</span>: {SCOPE_INFO[s].danger}
							</li>
						))}
					</ul>
					{callbackUrl && (
						<p className="text-sm break-all">
							You will be sent to <span className="font-mono">{callbackUrl}</span>, with the token after the #.
						</p>
					)}
				</AlertDescription>
			</Alert>

			<div className="space-y-2">
				<Label htmlFor="gen-name">Token name</Label>
				<Input id="gen-name" value={name} maxLength={MAX_TOKEN_NAME_LENGTH} onChange={e => setName(e.target.value)} />
			</div>

			<label className="flex items-start gap-2 text-sm">
				<input type="checkbox" className="mt-1" checked={trusted} onChange={e => setTrusted(e.target.checked)} />
				<span>I trust this source and know what this token can do.</span>
			</label>

			<div className="flex gap-3">
				<Button onClick={handleGenerate} disabled={!trusted || !name.trim() || submitting}>
					Generate token
				</Button>
				<Button variant="outline" onClick={() => window.location.assign('/dashboard')}>
					Cancel
				</Button>
			</div>
		</div>
	);
}
