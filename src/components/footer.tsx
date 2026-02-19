import Link from 'next/link';

export function Footer() {
	return (
		<footer className="border-t bg-card mt-auto" aria-label="Site footer">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
					<div className="space-y-3">
						<h2 className="text-sm font-semibold uppercase tracking-wider text-primary">About PartFiles</h2>
						<p className="text-sm text-muted-foreground leading-relaxed max-w-md">
							A minimalist file management and sharing platform. Built for speed, privacy, and ease of use. No tracking, no bloat, just
							your files when you need them.
						</p>
					</div>
					<div className="space-y-3 md:text-right">
						<nav className="flex flex-col md:items-end gap-2">
							<Link
								href="/docs"
								className="text-sm font-medium text-primary hover:text-primary/80 transition-colors underline underline-offset-4 decoration-primary/30 hover:decoration-primary"
							>
								API Documentation
							</Link>
							<Link
								href="/privacy"
								className="text-sm font-medium text-primary hover:text-primary/80 transition-colors underline underline-offset-4 decoration-primary/30 hover:decoration-primary"
							>
								Privacy Policy
							</Link>
							<p className="text-xs text-muted-foreground/60">We store your login and your files. That&apos;s it.</p>
						</nav>
					</div>
				</div>
				<div className="mt-8 pt-8 border-t border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
					<p className="text-xs text-muted-foreground">PartFiles</p>
					<div className="flex items-center gap-4">
						<a
							href="https://github.com/PartMan7/CMS"
							target="_blank"
							rel="noopener noreferrer"
							className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
						>
							GitHub
						</a>
					</div>
				</div>
			</div>
		</footer>
	);
}
