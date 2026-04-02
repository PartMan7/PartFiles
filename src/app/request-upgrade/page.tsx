import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { RequestUpgradeForm } from '@/components/request-upgrade-form';
import { isGuestRole } from '@/lib/permissions';

export default async function RequestUpgradePage() {
	const session = await auth();
	if (!session?.user) redirect('/login');
	if (!isGuestRole(session.user.role)) redirect('/dashboard');

	return (
		<>
			<Nav role={session.user.role} username={session.user.name ?? 'Unknown'} />
			<main id="main-content" className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<h1 className="text-3xl font-bold mb-6">Request an upgrade</h1>
				<RequestUpgradeForm />
			</main>
		</>
	);
}
