#!/bin/sh
set -eu

pnpm db:migrate:deploy
exec pnpm start:prod
