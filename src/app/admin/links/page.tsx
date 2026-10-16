import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { isAdmin } from '@/lib/permissions';
import { LinkManager } from '@/components/link-table';

export default async function AdminLinksPage() {
	const session = await auth();
	if (!session?.user) redirect('/login');
	if (!isAdmin(session.user.role)) redirect('/dashboard');

	return (
		<>
			<Nav role={session.user.role} username={session.user.name ?? 'Unknown'} />
			<main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<h1 className="text-3xl font-bold mb-6">Short Links</h1>
				<LinkManager />
			</main>
		</>
	);
}
