'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RequiredMark } from '@/components/required-mark';

export function SignupForm() {
	const router = useRouter();
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
			const res = await fetch('/api/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password }),
			});
			const data = (await res.json()) as { error?: string };

			if (!res.ok) {
				setError(data.error || 'Registration failed');
				setLoading(false);
				return;
			}

			const signInResult = await signIn('credentials', {
				username,
				password,
				redirect: false,
			});

			if (signInResult?.error) {
				setError('Account created but sign-in failed. Try logging in manually.');
				setLoading(false);
				return;
			}

			router.push('/dashboard');
			router.refresh();
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
					<CardTitle className="text-2xl text-primary">Create account</CardTitle>
					<CardDescription>Register as a guest (limited uploads)</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4" aria-label="Sign up form">
						<div aria-live="assertive" aria-atomic="true">
							{error && (
								<Alert variant="destructive">
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							)}
						</div>
						<div className="space-y-2">
							<Label htmlFor="signup-username">
								Username
								<RequiredMark />
							</Label>
							<Input
								id="signup-username"
								name="username"
								type="text"
								required
								minLength={3}
								maxLength={50}
								autoComplete="username"
								placeholder="Letters, numbers, _ and -"
								aria-required="true"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="signup-password">
								Password
								<RequiredMark />
							</Label>
							<Input
								id="signup-password"
								name="password"
								type="password"
								required
								minLength={8}
								maxLength={128}
								autoComplete="new-password"
								placeholder="8–128 characters"
								aria-required="true"
							/>
						</div>
						<Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
							{loading ? 'Creating account...' : 'Sign Up'}
						</Button>
						<p className="text-center text-sm text-muted-foreground">
							Already have an account?{' '}
							<Link href="/login" className="text-primary underline-offset-4 hover:underline">
								Sign in
							</Link>
						</p>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
