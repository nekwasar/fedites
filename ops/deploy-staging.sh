#!/bin/sh
# Staging pull-deploy (phases.md 0.1): run on the VPS with the image sha.
set -e
SHA="${1:-latest}"
cd /opt/fedites
API_IMAGE="fedites-api:${SHA}"
WEB_IMAGE="fedites-web:${SHA}"
API_SHA_FILE="/opt/fedites/.api-image"
WEB_SHA_FILE="/opt/fedites/.web-image"
echo "$SHA" > "$API_SHA_FILE"
echo "$SHA" > "$WEB_SHA_FILE"
echo "staging deploy recorded: api=$API_IMAGE web=$WEB_IMAGE"
