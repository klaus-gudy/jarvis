#!/bin/sh
set -eu

# Do not serve a release whose migrations failed. Exec passes signals to Node.
node node_modules/prisma/build/index.js migrate deploy
exec "$@"
