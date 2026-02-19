import { Nav } from '@/components/nav';
import { auth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function PrivacyPage() {
	const session = await auth();

	return (
		<>
			{session?.user && <Nav role={session.user.role} username={session.user.name ?? 'Unknown'} />}
			<main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<Card className="border-primary/20">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
					</CardHeader>
					<CardContent className="prose dark:prose-invert max-w-none space-y-6 text-muted-foreground">
						<section>
							<h2 className="text-xl font-semibold text-foreground">Disclaimer & Liability</h2>
							<p>
								PartFiles is provided &quot;as is&quot; without any guarantees or warranties. We are not liable for any issues,
								damages, or losses caused by the content stored on this site. We make no guarantees regarding the availability,
								persistence, or legality of the content hosted on this instance.
							</p>
						</section>

						<section>
							<h2 className="text-xl font-semibold text-foreground">Data Collection</h2>
							<p>We value your privacy. This application is designed to be as minimal as possible regarding data collection.</p>
						</section>

						<section>
							<h2 className="text-xl font-semibold text-foreground">Cookies</h2>
							<p>
								We do not track you using cookies. We only use cookies that are strictly necessary for the application to function,
								specifically for maintaining your login session. No third-party or advertising cookies are used.
							</p>
						</section>

						<section>
							<h2 className="text-xl font-semibold text-foreground">Browser Storage</h2>
							<p>
								We store no data on our servers regarding your personal preferences. We use your browser&apos;s local storage solely to
								remember your theme preferences (light/dark mode and accent color) to provide a consistent experience across visits.
							</p>
						</section>

						<section>
							<h2 className="text-xl font-semibold text-foreground">File Data</h2>
							<p>
								Any files you upload are stored securely and are only accessible via the links provided to you or by authorized
								administrators of this instance.
							</p>
						</section>

						<div className="pt-4 text-sm italic">Last updated: February 19, 2026</div>
					</CardContent>
				</Card>
			</main>
		</>
	);
}
