#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
PORT="${PORT:-3012}"
BASE_PATH="${BASE_PATH:-/hot-news}"
SERVER_URL="http://127.0.0.1:${PORT}${BASE_PATH}"
LOG_FILE="${ROOT_DIR}/.smoke-dist.log"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ ! -d "${DIST_DIR}" ]]; then
  echo "Smoke failed: dist directory not found. Run npm run build first."
  exit 1
fi

cd "${DIST_DIR}"
PORT="${PORT}" BASE_PATH="${BASE_PATH}" NODE_ENV=production node server.js > "${LOG_FILE}" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 30); do
  if curl -fsS "${SERVER_URL}/test" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS "${SERVER_URL}/test" >/dev/null

echo "Smoke dist passed: ${SERVER_URL}"
