'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RequiredMark } from '@/components/required-mark';

export default function InvitePage() {
	const { token } = useParams<{ token: string }>();
	const router = useRouter();

	const [status, setStatus] = useState<'loading' | 'valid' | 'error' | 'success'>('loading');
	const [username, setUsername] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const [formError, setFormError] = useState('');
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		async function validate() {
			try {
				const res = await fetch(`/api/invite/${token}`);
				const data = await res.json();

				if (res.ok && data.valid) {
					setUsername(data.username);
					setStatus('valid');
				} else {
					setErrorMessage(data.error || 'Invalid invite link');
					setStatus('error');
				}
			} catch {
				setErrorMessage('Failed to validate invite link');
				setStatus('error');
			}
		}
		validate();
	}, [token]);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setFormError('');
		setSubmitting(true);

		const formData = new FormData(e.currentTarget);
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (password !== confirmPassword) {
			setFormError('Passwords do not match');
			setSubmitting(false);
			return;
		}

		try {
			const res = await fetch(`/api/invite/${token}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password }),
			});

			const data = await res.json();

			if (res.ok && data.success) {
				setStatus('success');
			} else {
				setFormError(data.error || 'Failed to set password');
			}
		} catch {
			setFormError('An error occurred. Please try again.');
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="flex items-center justify-center p-4 min-h-[calc(100vh-200px)]">
			<Card className="w-full max-w-md border-primary/25">
				{status === 'loading' && (
					<>
						<CardHeader className="text-center">
							<CardTitle className="text-2xl text-primary">Validating Invite</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-center text-muted-foreground" role="status" aria-live="polite">
								Checking your invite link...
							</p>
						</CardContent>
					</>
				)}

				{status === 'error' && (
					<>
						<CardHeader className="text-center">
							<CardTitle className="text-2xl text-destructive">Invalid Invite</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<Alert variant="destructive">
								<AlertDescription>{errorMessage}</AlertDescription>
							</Alert>
							<p className="text-sm text-muted-foreground text-center">Please contact your administrator for a new invite link.</p>
						</CardContent>
					</>
				)}

				{status === 'valid' && (
					<>
						<CardHeader className="text-center">
							<CardTitle className="text-2xl text-primary">Set Your Password</CardTitle>
							<CardDescription>
								Welcome, <span className="font-semibold">{username}</span>! Choose a password to complete your account setup.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleSubmit} className="space-y-4" aria-label="Set password form">
								<div aria-live="assertive" aria-atomic="true">
									{formError && (
										<Alert variant="destructive">
											<AlertDescription>{formError}</AlertDescription>
										</Alert>
									)}
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
										minLength={8}
										autoComplete="new-password"
										placeholder="At least 8 characters"
										aria-required="true"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="confirmPassword">
										Confirm Password
										<RequiredMark />
									</Label>
									<Input
										id="confirmPassword"
										name="confirmPassword"
										type="password"
										required
										minLength={8}
										autoComplete="new-password"
										placeholder="Repeat your password"
										aria-required="true"
									/>
								</div>
								<Button type="submit" className="w-full" disabled={submitting} aria-busy={submitting}>
									{submitting ? 'Setting password...' : 'Set Password & Activate Account'}
								</Button>
							</form>
						</CardContent>
					</>
				)}

				{status === 'success' && (
					<>
						<CardHeader className="text-center">
							<CardTitle className="text-2xl text-primary">Account Ready</CardTitle>
							<CardDescription>
								Your password has been set. You can now sign in as <span className="font-semibold">{username}</span>.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button className="w-full" onClick={() => router.push('/login')}>
								Go to Login
							</Button>
						</CardContent>
					</>
				)}
			</Card>
		</div>
	);
}
