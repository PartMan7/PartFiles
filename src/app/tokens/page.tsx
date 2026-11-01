import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { TokenManager } from '@/components/token-manager';
import { canManageTokens } from '@/lib/token-scopes';

export default async function TokensPage() {
	const session = await auth();
	if (!session?.user) redirect('/login');
	if (!canManageTokens(session.user.role)) redirect('/dashboard');

	return (
		<>
			<Nav role={session.user.role} username={session.user.name ?? 'Unknown'} />
			<main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<h1 className="text-3xl font-bold mb-6">API Tokens</h1>
				<TokenManager role={session.user.role} />
			</main>
		</>
	);
}
