'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RequiredMark } from '@/components/required-mark';

/**
 * SECURITY: Only allow relative, same-origin redirects after login.
 * Blocks open-redirect attacks via crafted callbackUrl query params
 * (e.g. /login?callbackUrl=https://evil-site.com).
 */
function isSafeRedirect(url: string | null): boolean {
	if (!url) return false;
	// Must start with a single slash and not contain protocol-like patterns
	return url.startsWith('/') && !url.startsWith('//') && !url.includes(':');
}

export function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const raw = searchParams.get('callbackUrl');
	const callbackUrl = isSafeRedirect(raw) ? raw! : '/dashboard';
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError('');
		setLoading(true);

		const formData = new FormData(e.currentTarget);
		const username = formData.get('username') as string;
		const password = formData.get('password') as string;

		try {
			const result = await signIn('credentials', {
				username,
				password,
				redirect: false,
			});

			if (result?.error) {
				setError('Invalid username or password');
			} else {
				router.push(callbackUrl);
				router.refresh();
			}
		} catch {
			setError('An error occurred. Please try again.');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<Card className="w-full max-w-md border-primary/25">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl text-primary">PartFiles Login</CardTitle>
					<CardDescription>Sign in to files.partman.dev</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4" aria-label="Login form">
						<div aria-live="assertive" aria-atomic="true">
							{error && (
								<Alert variant="destructive">
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							)}
						</div>
						<div className="space-y-2">
							<Label htmlFor="username">
								Username
								<RequiredMark />
							</Label>
							<Input
								id="username"
								name="username"
								type="text"
								required
								autoComplete="username"
								placeholder="Enter your username"
								aria-required="true"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">
								Password
								<RequiredMark />
							</Label>
							<Input
								id="password"
								name="password"
								type="password"
								required
								autoComplete="current-password"
								placeholder="Enter your password"
								aria-required="true"
							/>
						</div>
						<Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
							{loading ? 'Signing in...' : 'Sign In'}
						</Button>
						<p className="text-center text-sm text-muted-foreground">
							No account?{' '}
							<Link href="/signup" className="text-primary underline-offset-4 hover:underline">
								Sign up
							</Link>
						</p>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
