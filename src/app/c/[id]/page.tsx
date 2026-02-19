import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { ContentViewer, type ContentViewData } from '@/components/content-viewer';
import { getContentUrl } from '@/lib/config';

interface ContentViewProps {
	params: Promise<{ id: string }>;
}

export default async function ContentViewPage({ params }: ContentViewProps) {
	const session = await auth();
	if (!session?.user) redirect('/login');

	const { id } = await params;

	const content = await prisma.content.findUnique({
		where: { id },
		include: {
			uploadedBy: { select: { username: true } },
			shortSlugs: { select: { slug: true } },
		},
	});

	if (!content) notFound();

	const data: ContentViewData = {
		id: content.id,
		filename: content.filename,
		originalFilename: content.originalFilename,
		fileSize: content.fileSize,
		fileExtension: content.fileExtension,
		mimeType: content.mimeType,
		directory: content.directory,
		expiresAt: content.expiresAt?.toISOString() ?? null,
		createdAt: content.createdAt.toISOString(),
		uploadedBy: content.uploadedBy,
		shortSlugs: content.shortSlugs,
	};

	return (
		<div className="min-h-screen">
			<Nav role={session.user.role} username={session.user.name ?? 'Unknown'} />
			<main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<ContentViewer content={data} contentBaseUrl={getContentUrl()} />
			</main>
		</div>
	);
}
