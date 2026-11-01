'use client';

import { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

/** View-once: parent holds the secret in memory only and clears it on dismiss. */
export function TokenReveal({ token, onDismiss }: { token: string; onDismiss: () => void }) {
	const [copied, setCopied] = useState(false);

	return (
		<Alert className="border-primary/40">
			<AlertDescription className="space-y-3">
				<div className="flex w-full items-center justify-between gap-2">
					<p className="font-semibold">Copy this token now. You won&apos;t see it again.</p>
					<Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Dismiss" onClick={onDismiss}>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="flex items-center gap-4 rounded-md bg-muted p-2 pl-3">
					<code className="flex-1 break-all py-1 text-sm font-mono">{token}</code>
					<Button
						type="button"
						size="sm"
						onClick={() => {
							void navigator.clipboard.writeText(token).then(() => {
								setCopied(true);
								setTimeout(() => setCopied(false), 2000);
							});
						}}
					>
						{copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
						{copied ? 'Copied' : 'Copy'}
					</Button>
				</div>
			</AlertDescription>
		</Alert>
	);
}
