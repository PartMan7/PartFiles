#!/usr/bin/env bash
# Works on main (dev dependency) and on the deploy branch (pinned CLI in ./tools).
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
	set -a
	. ./.env
	set +a
fi

PRISMA=./tools/node_modules/.bin/prisma
[ -x "$PRISMA" ] || PRISMA=./node_modules/.bin/prisma

exec "$PRISMA" migrate deploy --config=prisma.config.ts
