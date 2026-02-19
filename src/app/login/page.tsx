import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
	return (
		<main id="main-content" className="flex items-center justify-center min-h-[calc(100vh-200px)]">
			<Suspense
				fallback={
					<div className="flex items-center justify-center p-4">
						<p className="text-muted-foreground">Loading...</p>
					</div>
				}
			>
				<LoginForm />
			</Suspense>
		</main>
	);
}
