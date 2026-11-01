'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClientDateYmd } from '@/components/client-date-ymd';
import { TokenReveal } from '@/components/token-reveal';
import {
	MAX_TOKEN_NAME_LENGTH,
	SCOPE_INFO,
	TOKEN_EXPIRY_DAYS,
	TOKEN_SCOPES,
	canGrantScope,
	type TokenScope,
} from '@/lib/token-scopes';

const DEFAULT_SCOPES: TokenScope[] = ['me', 'upload'];

interface TokenItem {
	id: string;
	name: string;
	prefix: string;
	scopes: string[];
	expiresAt: string | null;
	lastUsedAt: string | null;
	revokedAt: string | null;
	createdAt: string;
}

export function expiryLabel(days: number | null): string {
	return days === null ? 'Never' : `${days} day${days === 1 ? '' : 's'}`;
}

function status(t: TokenItem): 'revoked' | 'expired' | 'active' {
	if (t.revokedAt) return 'revoked';
	if (t.expiresAt && new Date(t.expiresAt) <= new Date()) return 'expired';
	return 'active';
}

export function TokenManager({ role }: { role: string }) {
	const [tokens, setTokens] = useState<TokenItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [name, setName] = useState('');
	const [scopes, setScopes] = useState<TokenScope[]>(DEFAULT_SCOPES);
	const [days, setDays] = useState<number | null>(30);
	const [submitting, setSubmitting] = useState(false);
	const [revealed, setRevealed] = useState<string | null>(null);
	const [formOpen, setFormOpen] = useState(true);

	const fetchTokens = useCallback(async () => {
		try {
			const res = await fetch('/api/tokens');
			if (!res.ok) throw new Error();
			setTokens((await res.json()).tokens);
		} catch {
			toast.error('Failed to load tokens');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void fetchTokens();
	}, [fetchTokens]);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
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
			setRevealed(data.token);
			setFormOpen(false);
			setName('');
			setScopes(DEFAULT_SCOPES);
			await fetchTokens();
		} catch {
			toast.error('Failed to create token');
		} finally {
			setSubmitting(false);
		}
	}

	async function handleRevoke(t: TokenItem) {
		if (!confirm(`Revoke "${t.name}"? Anything using it will stop working immediately.`)) return;
		const res = await fetch(`/api/tokens/${encodeURIComponent(t.id)}`, { method: 'DELETE' });
		if (!res.ok) {
			toast.error('Failed to revoke token');
			return;
		}
		toast.success('Token revoked');
		await fetchTokens();
	}

	return (
		<div className="space-y-8">
			{revealed && <TokenReveal token={revealed} onDismiss={() => setRevealed(null)} />}

			<Card>
				<CardHeader className="cursor-pointer" onClick={() => setFormOpen(o => !o)}>
					<div className="flex items-center justify-between">
						<div className="space-y-1.5">
							<CardTitle>Create token</CardTitle>
							<CardDescription>You&apos;ll see the token once, right after you create it.</CardDescription>
						</div>
						<ChevronDown className={`h-5 w-5 transition-transform ${formOpen ? 'rotate-180' : ''}`} />
					</div>
				</CardHeader>
				{formOpen && (
					<CardContent>
						<form onSubmit={handleCreate} className="space-y-4">
							<div className="grid gap-4 sm:grid-cols-[1fr_auto]">
								<div className="space-y-2">
									<Label htmlFor="token-name">Name</Label>
									<Input
										id="token-name"
										value={name}
										maxLength={MAX_TOKEN_NAME_LENGTH}
										onChange={e => setName(e.target.value)}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="token-expiry">Expires</Label>
									<select
										id="token-expiry"
										className="block w-full rounded-md border bg-background px-3 py-2 text-sm"
										value={String(days)}
										onChange={e => setDays(e.target.value === 'null' ? null : Number(e.target.value))}
									>
										{TOKEN_EXPIRY_DAYS.map(d => (
											<option key={String(d)} value={String(d)}>
												{expiryLabel(d)}
											</option>
										))}
									</select>
								</div>
							</div>
							<fieldset className="space-y-2">
								<legend className="text-sm font-medium">Scopes</legend>
								{TOKEN_SCOPES.filter(s => canGrantScope(role, s)).map(s => (
									<label key={s} className="flex items-start gap-2 text-sm">
										<input
											type="checkbox"
											className="mt-1"
											checked={scopes.includes(s)}
											onChange={e => setScopes(prev => (e.target.checked ? [...prev, s] : prev.filter(x => x !== s)))}
										/>
										<span>
											<span className="font-mono font-medium">{s}</span> - {SCOPE_INFO[s].description}
										</span>
									</label>
								))}
							</fieldset>
							<Button type="submit" disabled={submitting || scopes.length === 0 || !name.trim()}>
								Generate token
							</Button>
						</form>
					</CardContent>
				)}
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Your tokens</CardTitle>
				</CardHeader>
				<CardContent>
					{loading ? (
						<p className="text-sm text-muted-foreground">Loading…</p>
					) : tokens.length === 0 ? (
						<p className="text-sm text-muted-foreground">No tokens yet.</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Token</TableHead>
									<TableHead>Scopes</TableHead>
									<TableHead>Created</TableHead>
									<TableHead>Last used</TableHead>
									<TableHead>Expires</TableHead>
									<TableHead>Status</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{tokens.map(t => {
									const st = status(t);
									return (
										<TableRow key={t.id}>
											<TableCell className="font-medium">{t.name}</TableCell>
											<TableCell className="font-mono">{t.prefix}...</TableCell>
											<TableCell className="space-x-1">
												{t.scopes.map(s => (
													<Badge key={s} variant="outline">
														{s}
													</Badge>
												))}
											</TableCell>
											<TableCell>
												<ClientDateYmd iso={t.createdAt} />
											</TableCell>
											<TableCell>{t.lastUsedAt ? <ClientDateYmd iso={t.lastUsedAt} /> : 'Never'}</TableCell>
											<TableCell>{t.expiresAt ? <ClientDateYmd iso={t.expiresAt} /> : 'Never'}</TableCell>
											<TableCell>
												<Badge variant={st === 'active' ? 'default' : 'secondary'}>{st}</Badge>
											</TableCell>
											<TableCell>
												{st === 'active' && (
													<Button variant="ghost" size="sm" onClick={() => handleRevoke(t)}>
														<Ban className="h-4 w-4 mr-1" />
														Revoke
													</Button>
												)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
