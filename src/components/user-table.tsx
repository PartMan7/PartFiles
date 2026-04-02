'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RequiredMark } from '@/components/required-mark';
import { toast } from 'sonner';
import { ClientDateYmd } from '@/components/client-date-ymd';

interface User {
	id: string;
	username: string;
	role: string;
	createdAt: string;
	_count: { content: number };
}

interface UserManagerProps {
	currentUserId: string;
}

export function UserManager({ currentUserId }: UserManagerProps) {
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreate, setShowCreate] = useState(false);
	const [editUser, setEditUser] = useState<User | null>(null);

	const fetchUsers = useCallback(async (opts?: { silent?: boolean }) => {
		try {
			const res = await fetch('/api/admin/users');
			const data = await res.json();
			setUsers(data.users || []);
		} catch {
			if (!opts?.silent) toast.error('Failed to load users');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	useEffect(() => {
		const id = window.setInterval(() => {
			void fetchUsers({ silent: true });
		}, 30_000);
		return () => clearInterval(id);
	}, [fetchUsers]);

	async function handleDelete(user: User) {
		if (!confirm(`Delete user "${user.username}"? This will also delete their content.`)) return;

		try {
			const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
			if (res.ok) {
				toast.success(`User "${user.username}" deleted`);
				fetchUsers();
			} else {
				const data = await res.json();
				toast.error(data.error || 'Failed to delete user');
			}
		} catch {
			toast.error('Failed to delete user');
		}
	}

	if (loading)
		return (
			<p className="text-muted-foreground" role="status" aria-live="polite">
				Loading users...
			</p>
		);

	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<p className="text-muted-foreground" aria-live="polite">
					{users.length} user(s)
				</p>
				<Dialog open={showCreate} onOpenChange={setShowCreate}>
					<DialogTrigger asChild>
						<Button>Add User</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Create New User</DialogTitle>
							<DialogDescription>Add a new user to the system. Users cannot register themselves.</DialogDescription>
						</DialogHeader>
						<CreateUserForm
							refetchUsers={() => fetchUsers()}
							onSuccess={() => {
								setShowCreate(false);
								fetchUsers();
							}}
						/>
					</DialogContent>
				</Dialog>
			</div>

			<Table aria-label="User accounts">
				<TableHeader>
					<TableRow>
						<TableHead>Username</TableHead>
						<TableHead>Role</TableHead>
						<TableHead>Content</TableHead>
						<TableHead>Created</TableHead>
						<TableHead className="text-right">
							<span className="sr-only">Actions</span>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{users.map(user => (
						<TableRow key={user.id}>
							<TableCell className="font-medium">{user.username}</TableCell>
							<TableCell>
								<Badge variant={user.role === 'admin' ? 'default' : 'outline'}>{user.role}</Badge>
							</TableCell>
							<TableCell>{user._count.content}</TableCell>
							<TableCell>
								<ClientDateYmd iso={user.createdAt} />
							</TableCell>
							<TableCell className="text-right space-x-2">
								<Dialog open={editUser?.id === user.id} onOpenChange={open => !open && setEditUser(null)}>
									<DialogTrigger asChild>
										<Button variant="outline" size="sm" onClick={() => setEditUser(user)}>
											Edit
										</Button>
									</DialogTrigger>
									<DialogContent>
										<DialogHeader>
											<DialogTitle>Edit User: {user.username}</DialogTitle>
											<DialogDescription>Update user details.</DialogDescription>
										</DialogHeader>
										<EditUserForm
											user={user}
											onSuccess={() => {
												setEditUser(null);
												fetchUsers();
											}}
										/>
									</DialogContent>
								</Dialog>
								{user.id !== currentUserId && (
									<Button variant="destructive" size="sm" onClick={() => handleDelete(user)}>
										Delete
									</Button>
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function CreateUserForm({ onSuccess, refetchUsers }: { onSuccess: () => void; refetchUsers: () => void }) {
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [role, setRole] = useState('guest');
	const [mode, setMode] = useState<'password' | 'invite'>('password');
	const [inviteUrl, setInviteUrl] = useState('');
	const [copied, setCopied] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError('');
		setLoading(true);
		setInviteUrl('');

		const formData = new FormData(e.currentTarget);

		const payload: Record<string, unknown> = {
			username: formData.get('username'),
			role,
		};

		if (mode === 'invite') {
			payload.invite = true;
		} else {
			payload.password = formData.get('password');
		}

		try {
			const res = await fetch('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data.error || 'Failed to create user');
			} else if (mode === 'invite' && data.inviteUrl) {
				setInviteUrl(data.inviteUrl);
				refetchUsers();
				toast.success(`User "${data.user.username}" created with invite link`);
			} else {
				toast.success(`User "${data.user.username}" created`);
				onSuccess();
			}
		} catch {
			setError('An error occurred');
		} finally {
			setLoading(false);
		}
	}

	function handleCopy() {
		navigator.clipboard.writeText(inviteUrl);
		setCopied(true);
		toast.success('Invite link copied to clipboard');
		setTimeout(() => setCopied(false), 2000);
	}

	// If an invite URL was generated, show it instead of the form
	if (inviteUrl) {
		return (
			<div className="space-y-4">
				<Alert>
					<AlertDescription>User created! Share this one-time invite link. It expires in 48 hours.</AlertDescription>
				</Alert>
				<div className="space-y-2">
					<Label>Invite Link</Label>
					<div className="flex gap-2">
						<Input value={inviteUrl} readOnly className="font-mono text-xs" />
						<Button type="button" variant="outline" onClick={handleCopy} className="shrink-0">
							{copied ? 'Copied!' : 'Copy'}
						</Button>
					</div>
				</div>
				<Button className="w-full" onClick={onSuccess}>
					Done
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<Tabs value={mode} onValueChange={v => setMode(v as 'password' | 'invite')}>
				<TabsList className="w-full">
					<TabsTrigger value="password" className="flex-1">
						Set Password
					</TabsTrigger>
					<TabsTrigger value="invite" className="flex-1">
						Invite Link
					</TabsTrigger>
				</TabsList>

				<form onSubmit={handleSubmit} className="space-y-4 pt-4" aria-label="Create new user">
					<div aria-live="assertive" aria-atomic="true">
						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="new-username">
							Username
							<RequiredMark />
						</Label>
						<Input id="new-username" name="username" required minLength={3} maxLength={50} aria-required="true" />
					</div>

					<TabsContent value="password" className="mt-0">
						<div className="space-y-2">
							<Label htmlFor="new-password">
								Password
								<RequiredMark />
							</Label>
							<Input
								id="new-password"
								name="password"
								type="password"
								required={mode === 'password'}
								minLength={8}
								maxLength={128}
								aria-required={mode === 'password'}
							/>
						</div>
					</TabsContent>

					<TabsContent value="invite" className="mt-0">
						<p className="text-sm text-muted-foreground">
							A one-time link will be generated. The new user will set their own password — you will never see it.
						</p>
					</TabsContent>

					<div className="space-y-2">
						<Label>
							Role
							<RequiredMark />
						</Label>
						<Select value={role} onValueChange={setRole} required>
							<SelectTrigger aria-label="Select role" aria-required="true">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="guest">Guest</SelectItem>
								<SelectItem value="uploader">Uploader</SelectItem>
								<SelectItem value="admin">Admin</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
						{loading ? 'Creating...' : mode === 'invite' ? 'Create User & Generate Link' : 'Create User'}
					</Button>
				</form>
			</Tabs>
		</div>
	);
}

function EditUserForm({ user, onSuccess }: { user: User; onSuccess: () => void }) {
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [role, setRole] = useState(user.role);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError('');
		setLoading(true);

		const formData = new FormData(e.currentTarget);
		const password = formData.get('password') as string;
		const username = formData.get('username') as string;

		const body: Record<string, string> = { role };
		if (username && username !== user.username) body.username = username;
		if (password) body.password = password;

		try {
			const res = await fetch(`/api/admin/users/${user.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data.error || 'Failed to update user');
			} else {
				toast.success('User updated');
				onSuccess();
			}
		} catch {
			setError('An error occurred');
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4" aria-label={`Edit user ${user.username}`}>
			<div aria-live="assertive" aria-atomic="true">
				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
			</div>
			<div className="space-y-2">
				<Label htmlFor="edit-username">Username</Label>
				<Input id="edit-username" name="username" defaultValue={user.username} minLength={3} maxLength={50} />
			</div>
			<div className="space-y-2">
				<Label htmlFor="edit-password">New Password</Label>
				<Input
					id="edit-password"
					name="password"
					type="password"
					minLength={8}
					maxLength={128}
					placeholder="Leave blank to keep current"
				/>
			</div>
			<div className="space-y-2">
				<Label>
					Role
					<RequiredMark />
				</Label>
				<Select value={role} onValueChange={setRole} required>
					<SelectTrigger aria-label="Select role" aria-required="true">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="guest">Guest</SelectItem>
						<SelectItem value="uploader">Uploader</SelectItem>
						<SelectItem value="admin">Admin</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
				{loading ? 'Saving...' : 'Save Changes'}
			</Button>
		</form>
	);
}
