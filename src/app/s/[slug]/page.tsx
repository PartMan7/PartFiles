import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Nav } from '@/components/nav';
import { ContentViewer, type ContentViewData } from '@/components/content-viewer';
import { getContentUrl } from '@/lib/url';

interface ShortViewProps {
	params: Promise<{ slug: string }>;
}

export default async function ShortViewPage({ params }: ShortViewProps) {
	const session = await auth();

	const { slug } = await params;

	const slugRecord = await prisma.shortSlug.findUnique({
		where: { slug },
		include: {
			content: {
				include: {
					uploadedBy: { select: { username: true } },
					shortSlugs: { select: { slug: true } },
				},
			},
		},
	});

	if (!slugRecord) notFound();
	const content = slugRecord.content;

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
		<>
			<Nav role={session?.user.role} username={session?.user.name ?? 'Not logged in'} />
			<main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<ContentViewer content={data} contentBaseUrl={getContentUrl()} />
			</main>
		</>
	);
}
