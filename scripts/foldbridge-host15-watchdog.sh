#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${FOLDBRIDGE_HOST15_WATCHDOG_STATE_DIR:-/home/sunhao/.local/state/foldbridge-host15-watchdog}"
LOCK_FILE="${FOLDBRIDGE_HOST15_WATCHDOG_LOCK_FILE:-$STATE_DIR/watchdog.lock}"
FLOCK_BIN="${FOLDBRIDGE_HOST15_WATCHDOG_FLOCK_BIN:-flock}"
READY_URL="${FOLDBRIDGE_HOST15_WATCHDOG_READY_URL:-http://127.0.0.1:20241/ready}"
METRICS_URL="${FOLDBRIDGE_HOST15_WATCHDOG_METRICS_URL:-http://127.0.0.1:20241/metrics}"
ORIGIN_URL="${FOLDBRIDGE_HOST15_WATCHDOG_ORIGIN_URL:-http://127.0.0.1:8888/entry-cases/cases/9ZC6/index.html}"
CONTAINER="${FOLDBRIDGE_HOST15_WATCHDOG_CONTAINER:-foldbridge-host15-cloudflared}"
FAILURE_THRESHOLD="${FOLDBRIDGE_HOST15_WATCHDOG_FAILURE_THRESHOLD:-3}"
COOLDOWN_SECONDS="${FOLDBRIDGE_HOST15_WATCHDOG_COOLDOWN_SECONDS:-600}"
MAX_RESTARTS_PER_HOUR="${FOLDBRIDGE_HOST15_WATCHDOG_MAX_RESTARTS_PER_HOUR:-3}"
DRY_RUN="${FOLDBRIDGE_HOST15_WATCHDOG_DRY_RUN:-0}"
NOW="${FOLDBRIDGE_HOST15_WATCHDOG_NOW:-$(date +%s)}"

STATE_FILE="$STATE_DIR/state.env"
LOG_FILE="$STATE_DIR/watchdog.log"
MAX_LOG_BYTES="${FOLDBRIDGE_HOST15_WATCHDOG_MAX_LOG_BYTES:-1048576}"

mkdir -p "$STATE_DIR"
exec 9>"$LOCK_FILE"
"$FLOCK_BIN" -n 9 || exit 0

consecutive_failures=0
last_restart=0
restart_window_start="$NOW"
restart_count=0
if [[ -f "$STATE_FILE" ]]; then
    while IFS='=' read -r key value; do
        case "$key" in
            consecutive_failures) consecutive_failures="${value:-0}" ;;
            last_restart) last_restart="${value:-0}" ;;
            restart_window_start) restart_window_start="${value:-$NOW}" ;;
            restart_count) restart_count="${value:-0}" ;;
        esac
    done < "$STATE_FILE"
fi

if (( NOW - restart_window_start >= 3600 )); then
    restart_window_start="$NOW"
    restart_count=0
fi

save_state() {
    local temporary="$STATE_FILE.tmp"
    {
        printf 'consecutive_failures=%s\n' "$consecutive_failures"
        printf 'last_restart=%s\n' "$last_restart"
        printf 'restart_window_start=%s\n' "$restart_window_start"
        printf 'restart_count=%s\n' "$restart_count"
    } > "$temporary"
    mv "$temporary" "$STATE_FILE"
}

write_log() {
    local line="$1"
    printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$line" >> "$LOG_FILE"
    if [[ -n "$MAX_LOG_BYTES" && -f "$LOG_FILE" ]] && (( $(wc -c < "$LOG_FILE") > MAX_LOG_BYTES )); then
        tail -c "$((MAX_LOG_BYTES / 2))" "$LOG_FILE" > "$LOG_FILE.tmp"
        mv "$LOG_FILE.tmp" "$LOG_FILE"
    fi
}

ready_body="$(curl --noproxy '*' -fsS --connect-timeout 3 --max-time 5 "$READY_URL" 2>/dev/null || true)"
metrics_body="$(curl --noproxy '*' -fsS --connect-timeout 3 --max-time 5 "$METRICS_URL" 2>/dev/null || true)"
origin_status="$(curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 5 "$ORIGIN_URL" 2>/dev/null || true)"
origin_status="${origin_status:-000}"

ready_connections="$(printf '%s\n' "$ready_body" | sed -n 's/.*"readyConnections"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -1)"
ha_connections="$(printf '%s\n' "$metrics_body" | awk '$1 == "cloudflared_tunnel_ha_connections" {print int($2); exit}')"
ready_connections="${ready_connections:-0}"
ha_connections="${ha_connections:-0}"

if [[ "$origin_status" == "200" ]]; then
    origin_state="healthy"
else
    origin_state="unhealthy:$origin_status"
fi

if (( ready_connections > 0 && ha_connections > 0 )); then
    consecutive_failures=0
    save_state
    line="readyConnections=$ready_connections haConnections=$ha_connections origin=$origin_state consecutive_failures=0 action=none"
    write_log "$line"
    printf '%s\n' "$line"
    exit 0
fi

consecutive_failures=$((consecutive_failures + 1))
action="none"
if (( consecutive_failures >= FAILURE_THRESHOLD )); then
    if (( NOW - last_restart >= COOLDOWN_SECONDS )); then
        if (( restart_count < MAX_RESTARTS_PER_HOUR )); then
            last_restart="$NOW"
            restart_count=$((restart_count + 1))
            consecutive_failures=0
            save_state
            if [[ "$DRY_RUN" == "1" ]]; then
                action="restart-dry-run"
            else
                if docker restart --time 10 "$CONTAINER" >/dev/null 2>&1; then
                    action="restart"
                else
                    action="restart-failed"
                fi
            fi
        else
            action="restart-cap-reached"
        fi
    else
        action="restart-cooldown"
    fi
fi

save_state
line="readyConnections=$ready_connections haConnections=$ha_connections origin=$origin_state consecutive_failures=$consecutive_failures action=$action"
write_log "$line"
printf '%s\n' "$line"
exit 1
