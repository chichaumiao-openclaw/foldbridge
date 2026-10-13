#!/usr/bin/env bash
set -euo pipefail

PRODUCTION_HOST="foldbridge.sunhao.uk"
HOST15_TEST_HOST="foldbridge-host15.sunhao.uk"
MAC_TUNNEL_ID="f2755002-1253-453e-8d31-be64bc44f51f"
HOST15_TUNNEL_ID="3a025f88-32a2-48e6-adf1-794e6aaa86ce"
DEFAULT_PROBE_PATH="/entry-cases/cases/9ZC6/index.html"

usage() {
    cat <<'EOF'
用法:
  scripts/foldbridge-host15-switch.sh check [path]
  scripts/foldbridge-host15-switch.sh host15 [path]
  scripts/foldbridge-host15-switch.sh mac [path]

host15 切换会先验证测试域名的 GET=200 和 OPTIONS=204，验证失败时不会改正式 DNS。
path 默认使用 /entry-cases/cases/9ZC6/index.html；文件同步完成后可传入实际验收路径。
EOF
}

probe_url() {
    local host="$1"
    local path="$2"
    local url="https://${host}${path}"
    local get_response
    local get_code
    local get_cors
    local options_response
    local options_code
    local options_cors

    get_response="$(curl -sS -o /dev/null -D - -w $'\n__STATUS__:%{http_code}\n' \
        -H 'Origin: https://foldbridge.ribocentre.org' \
        --connect-timeout 10 --max-time 30 "$url")"
    get_code="$(printf '%s\n' "$get_response" | awk -F: '/^__STATUS__:/ {print $2}')"
    get_cors="$(printf '%s\n' "$get_response" | tr -d '\r' | awk 'tolower($0) ~ /^access-control-allow-origin:/ {line=$0; sub(/^[^:]*:[[:space:]]*/, "", line); print line; exit}')"
    options_response="$(curl -sS -o /dev/null -D - -w $'\n__STATUS__:%{http_code}\n' -X OPTIONS \
        -H 'Origin: https://foldbridge.ribocentre.org' \
        -H 'Access-Control-Request-Method: GET' \
        --connect-timeout 10 --max-time 30 "$url")"
    options_code="$(printf '%s\n' "$options_response" | awk -F: '/^__STATUS__:/ {print $2}')"
    options_cors="$(printf '%s\n' "$options_response" | tr -d '\r' | awk 'tolower($0) ~ /^access-control-allow-origin:/ {line=$0; sub(/^[^:]*:[[:space:]]*/, "", line); print line; exit}')"
    printf '%s GET=%s OPTIONS=%s CORS_GET=%s CORS_OPTIONS=%s\n' \
        "$host" "$get_code" "$options_code" "${get_cors:-missing}" "${options_cors:-missing}"
    if [[ "$get_code" == "200" && "$options_code" == "204" ]] && \
        [[ "$get_cors" == "*" || "$get_cors" == "https://foldbridge.ribocentre.org" ]] && \
        [[ "$options_cors" == "*" || "$options_cors" == "https://foldbridge.ribocentre.org" ]]; then
        return 0
    fi
    return 1
}

route_to() {
    local tunnel_id="$1"
    cloudflared tunnel route dns --overwrite-dns "$tunnel_id" "$PRODUCTION_HOST"
}

command_name="${1:-}"
probe_path="${2:-$DEFAULT_PROBE_PATH}"

case "$command_name" in
    check)
        failed=0
        probe_url "$HOST15_TEST_HOST" "$probe_path" || failed=1
        probe_url "$PRODUCTION_HOST" "$probe_path" || failed=1
        exit "$failed"
        ;;
    host15)
        if ! probe_url "$HOST15_TEST_HOST" "$probe_path"; then
            printf 'Host 15 probe failed; production DNS was not changed.\n' >&2
            exit 1
        fi
        route_to "$HOST15_TUNNEL_ID"
        printf 'DNS target changed to Host 15. Verify production now:\n'
        probe_url "$PRODUCTION_HOST" "$probe_path"
        ;;
    mac)
        route_to "$MAC_TUNNEL_ID"
        printf 'DNS target changed to Mac. Verify production now:\n'
        probe_url "$PRODUCTION_HOST" "$probe_path"
        ;;
    *)
        usage >&2
        exit 2
        ;;
esac
