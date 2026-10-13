import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');
const switchScript = join(repoRoot, 'scripts/foldbridge-host15-switch.sh');
const servicesScript = join(repoRoot, 'scripts/foldbridge-host15-services.sh');
const watchdogScript = join(repoRoot, 'scripts/foldbridge-host15-watchdog.sh');

function makeFakeCommands() {
    const directory = mkdtempSync(join(tmpdir(), 'foldbridge-host15-test-'));
    const marker = join(directory, 'cloudflared-called');
    const curl = `#!/bin/sh
is_options=0
url=''
for arg in "$@"; do
    [ "$arg" = OPTIONS ] && is_options=1
    case "$arg" in https://*) url="$arg" ;; esac
done
if [ "$is_options" = 1 ] && echo "$url" | grep -q '__missing__'; then
    printf 'HTTP/2 204\\r\\nAccess-Control-Allow-Origin: *\\r\\n\\r\\n__STATUS__:204\\n'
elif [ "$is_options" = 1 ]; then
    printf 'HTTP/2 204\\r\\nAccess-Control-Allow-Origin: https://foldbridge.ribocentre.org\\r\\n\\r\\n__STATUS__:204\\n'
elif echo "$url" | grep -q '__missing__'; then
    printf 'HTTP/2 404\\r\\nAccess-Control-Allow-Origin: *\\r\\n\\r\\n__STATUS__:404\\n'
else
    printf 'HTTP/2 200\\r\\nAccess-Control-Allow-Origin: https://foldbridge.ribocentre.org\\r\\n\\r\\n__STATUS__:200\\n'
fi
`;
    const cloudflared = `#!/bin/sh
touch '${marker}'
`;
    writeFileSync(join(directory, 'curl'), curl);
    writeFileSync(join(directory, 'cloudflared'), cloudflared);
    chmodSync(join(directory, 'curl'), 0o755);
    chmodSync(join(directory, 'cloudflared'), 0o755);
    return { directory, marker };
}

test('Host 15 service uses the synchronized public directory as docroot', () => {
    const source = readFileSync(servicesScript, 'utf8');
    assert.match(source, /^DOCROOT="\/home\/sunhao\/Server15\/public"$/m);
});

test('origin health failure terminates PID 1 so Docker restarts it', () => {
    const source = readFileSync(servicesScript, 'utf8');
    assert.match(source, /--health-cmd '.+\|\| \{ kill -TERM 1; exit 1; \}'/);
});

test('cloudflared service exposes loopback-only metrics for the watchdog', () => {
    const source = readFileSync(servicesScript, 'utf8');
    assert.match(source, /^TUNNEL_IMAGE="cloudflare\/cloudflared:2026\.10\.0"$/m);
    assert.match(source, /^TUNNEL_PROTOCOL="\$\{FOLDBRIDGE_HOST15_TUNNEL_PROTOCOL:-http2\}"$/m);
    assert.match(source, /^METRICS_ADDRESS="127\.0\.0\.1:20241"$/m);
    assert.match(source, /tunnel --protocol "?\$TUNNEL_PROTOCOL"? --metrics "?\$METRICS_ADDRESS"? --url/);
});

test('switch guard rejects a missing Host 15 probe before routing DNS', () => {
    const { directory, marker } = makeFakeCommands();
    const result = spawnSync(switchScript, ['host15', '/__missing__'], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${directory}:/usr/bin:/bin` },
    });

    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.equal(existsSync(marker), false, 'cloudflared must not run after a failed probe');
});

test('check accepts the full allowed CORS origin value', () => {
    const { directory } = makeFakeCommands();
    const result = spawnSync(switchScript, ['check', '/'], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${directory}:/usr/bin:/bin` },
    });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /CORS_GET=https:\/\/foldbridge\.ribocentre\.org/);
});

function makeWatchdogCommands() {
    const directory = mkdtempSync(join(tmpdir(), 'foldbridge-host15-watchdog-test-'));
    const marker = join(directory, 'docker-restart');
    const curl = `#!/bin/sh
case "$*" in
  *'/ready'*) printf '{"status":200,"readyConnections":%s}\n' "${'${READY_CONNECTIONS:-4}'}" ;;
  *'/metrics'*) printf 'cloudflared_tunnel_ha_connections %s\n' "${'${HA_CONNECTIONS:-4}'}" ;;
  *) printf '%s' "${'${ORIGIN_STATUS:-200}'}" ;;
esac
`;
    const docker = `#!/bin/sh
if [ "$1" = restart ]; then printf 'restart\\n' >> '${marker}'; fi
exit "${'${DOCKER_EXIT_CODE:-0}'}"
`;
    const flock = '#!/bin/sh\nexit 0\n';
    writeFileSync(join(directory, 'curl'), curl);
    writeFileSync(join(directory, 'docker'), docker);
    writeFileSync(join(directory, 'flock'), flock);
    for (const command of ['curl', 'docker', 'flock']) chmodSync(join(directory, command), 0o755);
    return { directory, marker };
}

function runWatchdog(directory, stateDirectory, extraEnv = {}) {
    return spawnSync(watchdogScript, [], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
            ...process.env,
            PATH: `${directory}:/usr/bin:/bin`,
            FOLDBRIDGE_HOST15_WATCHDOG_STATE_DIR: stateDirectory,
            FOLDBRIDGE_HOST15_WATCHDOG_LOCK_FILE: join(stateDirectory, 'watchdog.lock'),
            FOLDBRIDGE_HOST15_WATCHDOG_FLOCK_BIN: join(directory, 'flock'),
            FOLDBRIDGE_HOST15_WATCHDOG_READY_URL: 'http://127.0.0.1:20241/ready',
            FOLDBRIDGE_HOST15_WATCHDOG_METRICS_URL: 'http://127.0.0.1:20241/metrics',
            FOLDBRIDGE_HOST15_WATCHDOG_ORIGIN_URL: 'http://127.0.0.1:8888/entry-cases/cases/9ZC6/index.html',
            FOLDBRIDGE_HOST15_WATCHDOG_NOW: '1700000000',
            ...extraEnv,
        },
    });
}

function watchdogFailure(result) {
    return `${result.stdout}${result.stderr}${result.error?.message || ''}`;
}

test('watchdog leaves a healthy four-connection tunnel alone', () => {
    const { directory, marker } = makeWatchdogCommands();
    const stateDirectory = mkdtempSync(join(tmpdir(), 'foldbridge-host15-watchdog-state-'));
    const result = runWatchdog(directory, stateDirectory);

    assert.equal(result.status, 0, watchdogFailure(result));
    assert.equal(existsSync(marker), false);
    assert.match(result.stdout, /readyConnections=4/);
    assert.match(result.stdout, /origin=healthy/);
});

test('watchdog does not restart after one failed tunnel sample', () => {
    const { directory, marker } = makeWatchdogCommands();
    const stateDirectory = mkdtempSync(join(tmpdir(), 'foldbridge-host15-watchdog-state-'));
    const result = runWatchdog(directory, stateDirectory, { READY_CONNECTIONS: '0', HA_CONNECTIONS: '0' });

    assert.equal(result.status, 1, watchdogFailure(result));
    assert.equal(existsSync(marker), false);
    assert.match(result.stdout, /consecutive_failures=1/);
});

test('watchdog restarts once after three consecutive zero-connection samples', () => {
    const { directory, marker } = makeWatchdogCommands();
    const stateDirectory = mkdtempSync(join(tmpdir(), 'foldbridge-host15-watchdog-state-'));
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        const result = runWatchdog(directory, stateDirectory, {
            READY_CONNECTIONS: '0',
            HA_CONNECTIONS: '0',
            FOLDBRIDGE_HOST15_WATCHDOG_NOW: String(1700000000 + attempt * 60),
        });
        assert.equal(result.status, 1, watchdogFailure(result));
    }
    assert.equal(existsSync(marker), true);
});

test('watchdog enforces restart cooldown and hourly restart cap', () => {
    const { directory, marker } = makeWatchdogCommands();
    const stateDirectory = mkdtempSync(join(tmpdir(), 'foldbridge-host15-watchdog-state-'));
    const failedSample = (now) => runWatchdog(directory, stateDirectory, {
        READY_CONNECTIONS: '0',
        HA_CONNECTIONS: '0',
        FOLDBRIDGE_HOST15_WATCHDOG_NOW: String(now),
    });
    for (const now of [60, 120, 180, 240, 300, 360]) {
        assert.equal(failedSample(1700000000 + now).status, 1);
    }
    assert.equal(readFileSync(marker, 'utf8').trim().split('\n').length, 1);

    for (const base of [800, 1500, 2200]) {
        for (const offset of [0, 60, 120]) assert.equal(failedSample(1700000000 + base + offset).status, 1);
    }
    assert.equal(readFileSync(marker, 'utf8').trim().split('\n').length, 3);
});

test('watchdog separates origin failure from tunnel failure', () => {
    const { directory, marker } = makeWatchdogCommands();
    const stateDirectory = mkdtempSync(join(tmpdir(), 'foldbridge-host15-watchdog-state-'));
    const result = runWatchdog(directory, stateDirectory, { ORIGIN_STATUS: '503' });

    assert.equal(result.status, 0, watchdogFailure(result));
    assert.equal(existsSync(marker), false);
    assert.match(result.stdout, /readyConnections=4/);
    assert.match(result.stdout, /origin=unhealthy:503/);
});

test('a failed Docker restart still consumes the cooldown and logs the failure', () => {
    const { directory, marker } = makeWatchdogCommands();
    const stateDirectory = mkdtempSync(join(tmpdir(), 'foldbridge-host15-watchdog-state-'));
    const sample = (now) => runWatchdog(directory, stateDirectory, {
        READY_CONNECTIONS: '0', HA_CONNECTIONS: '0', DOCKER_EXIT_CODE: '1',
        FOLDBRIDGE_HOST15_WATCHDOG_NOW: String(now),
    });
    for (const offset of [60, 120]) assert.equal(sample(1700000000 + offset).status, 1);
    assert.match(sample(1700000180).stdout, /action=restart-failed/);
    for (const offset of [240, 300, 360]) sample(1700000000 + offset);
    assert.equal(readFileSync(marker, 'utf8').trim().split('\n').length, 1);
    assert.match(readFileSync(join(stateDirectory, 'watchdog.log'), 'utf8'), /action=restart-failed/);
});
