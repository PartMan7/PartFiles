import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { ContentManager } from '@/components/content-table';
import { getContentUrl } from '@/lib/url';
import { canBrowseContent, isAdmin } from '@/lib/permissions';

export default async function ContentPage() {
	const session = await auth();
	if (!session?.user) redirect('/login');
	if (!canBrowseContent(session.user.role)) redirect('/dashboard');

	return (
		<>
			<Nav role={session.user.role} username={session.user.name ?? 'Unknown'} />
			<main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<h1 className="text-3xl font-bold mb-2">Content</h1>
				<p className="text-muted-foreground mb-6">Files you have uploaded to this site.</p>
				<ContentManager
					contentBaseUrl={getContentUrl()}
					isAdmin={isAdmin(session.user.role)}
					sessionUsername={session.user.name ?? ''}
				/>
			</main>
		</>
	);
}
