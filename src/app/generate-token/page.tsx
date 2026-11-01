import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { GenerateTokenForm } from '@/components/generate-token-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
	MAX_TOKEN_NAME_LENGTH,
	TOKEN_EXPIRY_DAYS,
	canGrantScope,
	canManageTokens,
	parseCallbackUrl,
	parseScopes,
} from '@/lib/token-scopes';

type Params = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Link format: /generate-token?scopes=me,upload&callback-url=https://app/cb&name=My+agent&expires=30|never */
export default async function GenerateTokenPage({ searchParams }: { searchParams: Params }) {
	const sp = await searchParams;
	const session = await auth();
	if (!session?.user) {
		const qs = new URLSearchParams();
		for (const [k, v] of Object.entries(sp)) if (first(v) !== undefined) qs.set(k, first(v)!);
		redirect(`/login?callbackUrl=${encodeURIComponent(`/generate-token?${qs}`)}`);
	}
	if (!canManageTokens(session.user.role)) redirect('/dashboard');

	const scopes = parseScopes(first(sp.scopes));
	const rawCallback = first(sp['callback-url']);
	const callback = parseCallbackUrl(rawCallback);
	const rawExpires = first(sp.expires);
	const days = rawExpires === 'never' ? null : rawExpires === undefined ? 30 : Number(rawExpires);

	let error: string | null = null;
	if (!scopes) error = 'This link has missing or unknown scopes.';
	else if (!scopes.every(s => canGrantScope(session.user.role, s))) error = "Your account can't grant one of these scopes.";
	else if (rawCallback && !callback) error = "The callback URL isn't valid. It must be https, with no username or password.";
	else if (days !== null && !(TOKEN_EXPIRY_DAYS as readonly (number | null)[]).includes(days)) error = "That expiry isn't allowed.";

	return (
		<>
			<Nav role={session.user.role} username={session.user.name ?? 'Unknown'} />
			<main id="main-content" className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<h1 className="text-3xl font-bold mb-6">Generate API token</h1>
				{error || !scopes ? (
					<Alert variant="destructive">
						<AlertDescription>{error} No token was made.</AlertDescription>
					</Alert>
				) : (
					<GenerateTokenForm
						scopes={scopes}
						days={days}
						callbackUrl={callback?.toString() ?? null}
						defaultName={(first(sp.name) ?? '').slice(0, MAX_TOKEN_NAME_LENGTH)}
					/>
				)}
			</main>
		</>
	);
}
