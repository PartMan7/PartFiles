# Production Deployment

PartFiles deploys via a dedicated `deploy` branch that contains a
pre-built, standalone Next.js server. A GitHub Actions workflow
automatically builds every revision that passes CI on `main` and
force-pushes the artefacts to `deploy`. Your production machine only
needs to `git pull` and restart the process.

---

## One-time server setup

### 1. Clone the deploy branch

```bash
git clone --single-branch --branch deploy \
  git@github.com:<owner>/PartFiles.git /opt/partfiles
cd /opt/partfiles
```

### 2. Create the `.env` file

Copy the template and fill in **real** values:

```bash
cp .env.example .env
chmod 600 .env          # readable only by the owner
```

Open `.env` in your editor and set every variable:

| Variable                 | How to populate                                                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | Absolute path to your SQLite database, e.g. `file:/opt/partfiles/data/partfiles.db`. **Must be outside the repo** or in a git-ignored directory so it is never committed.                            |
| `AUTH_SECRET`            | Generate a strong random string: `openssl rand -base64 32`. Must be ≥ 32 characters. This signs all session JWTs — keep it secret and never change it unless you intend to invalidate every session. |
| `CRON_SECRET`            | Another random string (`openssl rand -base64 32`). Must match the value used by the cleanup cron job.                                                                                                |
| `UPLOAD_DIR`             | Absolute path for uploaded files, e.g. `/opt/partfiles/uploads`. Must be writable by the Node process and **not** inside the repo tree (or inside a git-ignored directory).                          |
| `INITIAL_ADMIN_PASSWORD` | Password for the first admin account created by the seed script. Change it on first login.                                                                                                           |
| `BASE_URL`               | The public URL of your server, e.g. `https://files.example.com`. No trailing slash.                                                                                                                  |
| `CONTENT_URL`            | _(Optional)_ A separate origin for content routes (`/c/`, `/s/`, `/r/`, `/e/`). Falls back to `BASE_URL` when unset.                                                                                 |

> **Security**: The `.env` file is listed in the deploy branch's
> `.gitignore` and will never be tracked. Do **not** remove it from
> `.gitignore`. Do **not** commit secrets to any branch.

### 3. Run database migrations

Install the Prisma CLI once (it is not included in the standalone build):

```bash
npm install -g prisma
```

Then apply all pending migrations:

```bash
prisma migrate deploy --config=prisma.config.ts
```

### 4. (Optional) Seed the database

If this is a fresh install, seed the initial admin user. Make sure your
`.env` is in place first (the seed script reads `DATABASE_URL` and
`INITIAL_ADMIN_PASSWORD` from it):

```bash
npm install -g tsx
tsx prisma/seed.mts
```

### 5. Prepare directories

```bash
mkdir -p /opt/partfiles/uploads /opt/partfiles/logs
```

### 6. Start the server with PM2

An `ecosystem.config.cjs` is included in the deploy branch. PM2 is
configured to run the server with `node -r dotenv/config server.js`, so
`.env` in the working directory is loaded before the app starts and all
your variables are available to the process.

```bash
cd /opt/partfiles
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # follow the printed command to enable boot persistence
```

### 7. Set up the cleanup cron

```bash
chmod +x scripts/cron-cleanup.sh
```

Add to crontab (`crontab -e`):

```
0 * * * * /opt/partfiles/scripts/cron-cleanup.sh >> /opt/partfiles/logs/cleanup.log 2>&1
```

---

## Automatic deploys (git pull + restart)

When the `deploy` branch is updated, your server should:

1. Pull the latest build artefacts.
2. Run any pending Prisma migrations.
3. Restart the Node process.

### Webhook / git hook script

Create a script that your webhook receiver (or a bare-repo `post-receive`
hook) invokes:

```bash
#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="/opt/partfiles"
cd "$DEPLOY_DIR"

# Load environment so prisma can find DATABASE_URL
set -a
. "$DEPLOY_DIR/.env"
set +a

git fetch origin deploy
git reset --hard origin/deploy

# Apply any new migrations
prisma migrate deploy --config=prisma.config.ts 2>&1 || true

# Restart the service
pm2 restart partfiles
```

> If you use a GitHub webhook, point it at a lightweight HTTP listener
> (e.g. a small webhook server) that verifies the payload signature and
> runs the script above.

---

## Security checklist

- [ ] `.env` exists only on the production machine, never in git.
- [ ] `DATABASE_URL` points to a path outside the repo (or git-ignored).
- [ ] `UPLOAD_DIR` points to a path outside the repo (or git-ignored).
- [ ] `AUTH_SECRET` was generated with `openssl rand -base64 32`.
- [ ] `CRON_SECRET` was generated with `openssl rand -base64 32`.
- [ ] `.env` has `chmod 600` permissions.
- [ ] The deploy branch's `.gitignore` excludes `.env*`, `*.db`, `/uploads/`, `/logs/`.
- [ ] No secret values appear in any GitHub Actions logs or commit messages.
- [ ] Branch protection is enabled on `main` (require CI to pass before merge).

---

## Updating

Every push to `main` that passes CI will automatically rebuild and
update the `deploy` branch. Your server picks up the change via the
mechanism described above — no manual build step required.

To run migrations after a schema change, the deploy hook script already
handles this (`prisma migrate deploy`). If you prefer manual control,
SSH into the server and run:

```bash
cd /opt/partfiles && prisma migrate deploy --config=prisma.config.ts
```
