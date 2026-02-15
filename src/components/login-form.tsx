'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
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
				<CardTitle className="text-2xl text-primary">CMS Login</CardTitle>
					<CardDescription>Sign in to cms.partman.dev</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}
						<div className="space-y-2">
							<Label htmlFor="username">Username</Label>
							<Input id="username" name="username" type="text" required autoComplete="username" placeholder="Enter your username" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								name="password"
								type="password"
								required
								autoComplete="current-password"
								placeholder="Enter your password"
							/>
						</div>
						<Button type="submit" className="w-full" disabled={loading}>
							{loading ? 'Signing in...' : 'Sign In'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
