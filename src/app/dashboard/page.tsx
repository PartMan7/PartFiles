import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { STORAGE_LIMITS } from '@/lib/config';
import { canUpload, isAdmin } from '@/lib/permissions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function DashboardPage() {
	const session = await auth();
	if (!session?.user) redirect('/login');

	const { id: userId, role, name: username } = session.user;

	// Get user's content stats
	const contentStats = await prisma.content.aggregate({
		where: {
			uploadedById: userId,
			OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
		},
		_sum: { fileSize: true },
		_count: true,
	});

	const usedBytes = contentStats._sum.fileSize ?? 0;
	const limitBytes = STORAGE_LIMITS[role] ?? 0;
	const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
	const limitMB = limitBytes > 0 ? (limitBytes / (1024 * 1024)).toFixed(0) : 'N/A';
	const usagePercent = limitBytes > 0 ? ((usedBytes / limitBytes) * 100).toFixed(1) : '0';

	// Admin stats
	let totalUsers = 0;
	let totalContent = 0;
	if (isAdmin(role)) {
		totalUsers = await prisma.user.count();
		totalContent = await prisma.content.count();
	}

	return (
		<>
			<Nav role={role} username={username ?? 'Unknown'} />
			<main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<h1 className="text-3xl font-bold mb-6">Dashboard</h1>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{/* User Info */}
					<Card>
						<CardHeader>
							<CardTitle>Your Account</CardTitle>
							<CardDescription>Account details</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Username</span>
								<span className="font-medium">{username}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Role</span>
								<Badge>{role}</Badge>
							</div>
						</CardContent>
					</Card>

					{/* Storage Usage */}
					{canUpload(role) && (
						<Card>
							<CardHeader>
								<CardTitle>Storage Usage</CardTitle>
								<CardDescription>
									{usedMB} MB / {limitMB} MB ({usagePercent}%)
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div
									className="w-full bg-muted rounded-full h-3"
									role="progressbar"
									aria-valuenow={Math.min(Number(usagePercent), 100)}
									aria-valuemin={0}
									aria-valuemax={100}
									aria-label={`Storage usage: ${usedMB} MB of ${limitMB} MB used`}
								>
									<div
										className="bg-primary h-3 rounded-full transition-all"
										style={{ width: `${Math.min(Number(usagePercent), 100)}%` }}
									/>
								</div>
								<p className="text-sm text-muted-foreground mt-2">{contentStats._count} active file(s)</p>
							</CardContent>
						</Card>
					)}

					{/* Quick Actions — only shown when the user has at least one action */}
					{(canUpload(role) || isAdmin(role)) && (
						<Card>
							<CardHeader>
								<CardTitle>Quick Actions</CardTitle>
								<CardDescription>Common tasks</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-col gap-3">
								{canUpload(role) && (
									<Link href="/upload">
										<Button className="w-full" variant="outline">
											Upload Content
										</Button>
									</Link>
								)}
								{isAdmin(role) && (
									<>
										<Link href="/admin/users">
											<Button className="w-full" variant="outline">
												Manage Users
											</Button>
										</Link>
										<Link href="/admin/content">
											<Button className="w-full" variant="outline">
												Manage Content
											</Button>
										</Link>
									</>
								)}
							</CardContent>
						</Card>
					)}

					{/* Admin Stats */}
					{isAdmin(role) && (
						<Card>
							<CardHeader>
								<CardTitle>System Stats</CardTitle>
								<CardDescription>Overview</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Total Users</span>
									<span className="font-medium">{totalUsers}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Total Content</span>
									<span className="font-medium">{totalContent}</span>
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</main>
		</>
	);
}
