#!/usr/bin/env bash
set -euo pipefail

ORIGIN_CONTAINER="foldbridge-host15-origin"
TUNNEL_CONTAINER="foldbridge-host15-cloudflared"
ORIGIN_IMAGE="python:3.12-alpine"
TUNNEL_IMAGE="cloudflare/cloudflared:2026.10.0"
# Host 15's UDP/QUIC path repeatedly timed out during the 2026-10-13 test;
# keep TCP/HTTP2 as the production default. Override explicitly for experiments.
TUNNEL_PROTOCOL="${FOLDBRIDGE_HOST15_TUNNEL_PROTOCOL:-http2}"
METRICS_ADDRESS="127.0.0.1:20241"
DOCROOT="/home/sunhao/Server15/public"
SERVER_SCRIPT="/home/sunhao/.local/lib/foldbridge/cors_static_server.py"
TOKEN_FILE="/home/sunhao/.cloudflared/foldbridge-host15.token"

status() {
    docker ps --filter "name=foldbridge-host15" \
        --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
    printf 'local GET: '
    curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8888/
    printf 'local OPTIONS: '
    curl -sS -o /dev/null -w '%{http_code}\n' -X OPTIONS \
        -H 'Origin: https://foldbridge.ribocentre.org' \
        -H 'Access-Control-Request-Method: GET' \
        http://127.0.0.1:8888/
}

up() {
    test -d "$DOCROOT"
    test -r "$SERVER_SCRIPT"
    test -s "$TOKEN_FILE"
    test "$(stat -c %a "$TOKEN_FILE")" = "600"

    docker image inspect "$ORIGIN_IMAGE" >/dev/null 2>&1 || docker pull "$ORIGIN_IMAGE"
    docker image inspect "$TUNNEL_IMAGE" >/dev/null 2>&1 || docker pull "$TUNNEL_IMAGE"

    for container in "$ORIGIN_CONTAINER" "$TUNNEL_CONTAINER"; do
        if docker container inspect "$container" >/dev/null 2>&1; then
            docker rm -f "$container" >/dev/null
        fi
    done

    docker run -d \
        --name "$ORIGIN_CONTAINER" \
        --restart unless-stopped \
        --network host \
        --user 1004:1001 \
        --read-only \
        --tmpfs /tmp:rw,noexec,nosuid,size=16m \
        --mount "type=bind,src=$SERVER_SCRIPT,dst=/app/cors_static_server.py,readonly" \
        --mount "type=bind,src=$DOCROOT,dst=/srv/foldbridge,readonly" \
        --health-cmd 'python -c "import urllib.request; urllib.request.urlopen(\"http://127.0.0.1:8888/\",timeout=3).read(1)" || { kill -TERM 1; exit 1; }' \
        --health-interval 30s \
        --health-timeout 5s \
        --health-retries 3 \
        --health-start-period 5s \
        "$ORIGIN_IMAGE" \
        python /app/cors_static_server.py \
            --bind 127.0.0.1 \
            --port 8888 \
            --directory /srv/foldbridge >/dev/null

    docker run -d \
        --name "$TUNNEL_CONTAINER" \
        --restart unless-stopped \
        --network host \
        --user 1004:1001 \
        --mount "type=bind,src=$TOKEN_FILE,dst=/run/secrets/tunnel-token,readonly" \
        "$TUNNEL_IMAGE" \
        tunnel --protocol "$TUNNEL_PROTOCOL" --metrics "$METRICS_ADDRESS" --url http://127.0.0.1:8888 \
            run --token-file /run/secrets/tunnel-token >/dev/null

    sleep 10
    status
}

case "${1:-status}" in
    status)
        status
        ;;
    up)
        up
        ;;
    *)
        printf 'Usage: %s {status|up}\n' "$0" >&2
        exit 2
        ;;
esac
