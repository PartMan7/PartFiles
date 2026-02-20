import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { hashSync } from 'bcryptjs';
import path from 'path';

function resolveDbUrl(): string {
	const raw = process.env.DATABASE_URL || 'file:./dev.db';
	if (raw.startsWith('file:')) {
		const filePath = raw.slice(5);
		const absPath = path.resolve(process.cwd(), filePath);
		return `file:${absPath}`;
	}
	return raw;
}

const adapter = new PrismaBetterSqlite3({ url: resolveDbUrl() });
const prisma = new PrismaClient({ adapter });

async function main() {
	const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
	if (!adminPassword) {
		throw new Error(
			'INITIAL_ADMIN_PASSWORD environment variable is required. ' + 'Set it to a strong password before running the seed.'
		);
	}

	const admin = await prisma.user.upsert({
		where: { username: 'admin' },
		update: {},
		create: {
			username: 'admin',
			passwordHash: hashSync(adminPassword, 12),
			role: 'admin',
		},
	});

	console.log(`Admin user created/exists: ${admin.username} (${admin.id})`);

	const directories = [
		{ name: 'General', path: 'general' },
		{ name: 'Images', path: 'images' },
		{ name: 'Documents', path: 'documents' },
		{ name: 'Media', path: 'media' },
	];

	for (const dir of directories) {
		const result = await prisma.allowedDirectory.upsert({
			where: { name: dir.name },
			update: {},
			create: dir,
		});
		console.log(`Directory created/exists: ${result.name} -> ${result.path}`);
	}

	console.log('\nSeed completed successfully.');
	console.log('Admin user ready: username=admin');
	console.log('IMPORTANT: Change the admin password after first login.');
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
