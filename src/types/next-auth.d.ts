import 'next-auth';
import type { Role } from '@/lib/config';

declare module 'next-auth' {
	interface Session {
		user: {
			id: string;
			name: string;
			role: Role;
			email?: string | null;
			image?: string | null;
		};
	}

	interface User {
		role?: Role;
	}
}

declare module 'next-auth/jwt' {
	interface JWT {
		id: string;
		role: Role;
	}
}
