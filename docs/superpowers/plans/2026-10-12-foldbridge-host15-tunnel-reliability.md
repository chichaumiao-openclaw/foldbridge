# FoldBridge Host 15 Tunnel Reliability and Maintenance Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce user-visible downtime during Host 15 Tunnel connection loss, make the connector restartable when it is alive but unhealthy, and show a maintenance fallback from the GitHub Pages portal when case pages cannot be reached.

**Architecture:** Keep Host 15 as the case origin and keep the Mac tunnel as a manually controlled backup. Add a Host 15 watchdog around cloudflared's local `/ready` and `/metrics` endpoints, use an externally served portal fallback for iframe failures, and record enough state to avoid restart loops. Do not make DNS failover automatic and do not couple the maintenance page to the Host 15 docroot.

**Tech Stack:** Bash, Docker, cloudflared Prometheus metrics/ready endpoints, browser-native JavaScript/CSS, Node.js `node:test`, GitHub Pages.

**Spec:** Investigation evidence in `docs/runbooks/foldbridge-host15-tunnel-runbook.md`, `docs/网站更新手册_DEPLOYMENT_HANDBOOK.md`, and the Host 15 logs collected on 2026-10-12. There is no dedicated maintenance page file in `ghhttps/main`; the portal already has `src/entryCaseEmbed.js` and an iframe loading indicator that this plan extends.

## Global Constraints

- Preserve Host 15 as the production case origin and Mac as a manual hot backup.
- Do not enable automatic DNS movement between Host 15 and Mac.
- Do not modify Host 15 NIC settings, kernel networking, or other users' compute jobs without separate authorization.
- Keep the tunnel token outside `/home/sunhao/Server15/public` and at mode `0600`.
- Do not treat a case-level 404 as a tunnel outage or show the site-wide maintenance page for a missing PDB/case.
- Any Host 15 service change must be applied through `/home/sunhao/.local/bin/foldbridge-host15-services` and verified on both the test hostname and the production hostname.
- Keep the maintenance fallback independent of `foldbridge-host15.sunhao.uk` and `foldbridge.sunhao.uk`.

## Review Focus

- **All four connections fail together:** the watchdog must detect `/ready` losing all connections and restart once after a cooldown, without restarting on a single connection flap.
- **Cloudflare or upstream outage:** repeated `/ready` failures must hit a restart backoff and stop retrying indefinitely; the portal must still show a useful fallback.
- **Origin-only failure:** a healthy tunnel with a failing `127.0.0.1:8888` must be reported as origin failure and must not be misclassified as an edge outage.
- **Normal iframe load and case 404:** a successful iframe hides the fallback; an intentional missing case keeps a case-not-found message instead of maintenance mode.
- **Portal deployment failure or stale cache:** the fallback copy must be static, accessible from the Pages origin, and covered by a build/deploy smoke test.

### Task 1: Capture the current Host 15 service and metrics contract

**Files:**
- Modify: `docs/runbooks/foldbridge-host15-tunnel-runbook.md`
- Modify: `docs/网站更新手册_DEPLOYMENT_HANDBOOK.md`
- Test: shell commands executed on Host 15 and from the public probe client

**Interfaces:**
- Consumes: current Docker service, `http://127.0.0.1:20241/ready`, `http://127.0.0.1:20241/metrics`, and `/diag/tunnel`.
- Produces: a documented health contract and a before-change baseline.

- [ ] **Step 1: Record a baseline before changing containers.**

  Capture `docker inspect`, `cloudflared --version`, `curl /ready`, `curl /metrics`, `curl /diag/tunnel`, local origin probes, public test-host probes, and the last 24 hours of connector logs. Store only non-secret output in the runbook or an incident artifact; never print the token.

- [ ] **Step 2: Define the health contract.**

  Document that `/ready` is the fast liveness gate, `readyConnections=4` is the normal state, `readyConnections=0` for three consecutive samples is the restart condition, and the origin probe is evaluated separately. Document the current evidence: containers have not restarted, while all four edge connections have periodically closed and re-registered.

- [ ] **Step 3: Verify the baseline.**

  Run `curl -fsS http://127.0.0.1:20241/ready`, parse `readyConnections`, and run the real case probe through both the test and production hostnames. Expected: all current checks pass and no secret appears in captured output.

### Task 2: Add a guarded Host 15 cloudflared watchdog

**Files:**
- Create: `scripts/foldbridge-host15-watchdog.sh`
- Modify: `scripts/foldbridge-host15-services.sh`
- Modify: `tests/foldbridge-host15-ops.test.mjs`
- Modify: `docs/runbooks/foldbridge-host15-tunnel-runbook.md`

**Interfaces:**
- Consumes: `GET http://127.0.0.1:20241/ready`, `GET http://127.0.0.1:20241/metrics`, `docker inspect`, and the local origin probe.
- Produces: exit code `0` when the tunnel is healthy, exit code `1` when the sample is unhealthy but no restart is due, and a controlled `docker restart foldbridge-host15-cloudflared` after the threshold.

- [ ] **Step 1: Write failing local tests for the watchdog decision logic.**

  Test the following pure shell/test-fixture cases: four ready connections produce no restart; one failed sample produces no restart; three consecutive zero-connection samples produce one restart; a restart within the cooldown is suppressed; a healthy sample clears the consecutive-failure counter; origin failure is reported separately; and a missing metrics endpoint is treated as unhealthy without an unbounded loop.

- [ ] **Step 2: Implement the minimal watchdog.**

  Use `flock` to serialize runs. Read `/ready` with a short timeout, parse `readyConnections`, and keep state under `/home/sunhao/.local/state/foldbridge-host15-watchdog/`. Require three consecutive unhealthy samples, enforce a cooldown of at least 10 minutes, cap restarts to three per hour, and write timestamped reason/status lines to a rotating log. Use `docker restart foldbridge-host15-cloudflared` only after the guard passes. Never log the token or full request headers.

- [ ] **Step 3: Add a metrics endpoint to the actual container command.**

  Change the service script to bind cloudflared metrics to a loopback-only address and stable port, for example `--metrics 127.0.0.1:20241`, while retaining the existing origin URL and token-file mount. Do not expose the metrics endpoint publicly. Keep the image tag in one variable so the upgrade in Task 3 is a single controlled change.

- [ ] **Step 4: Add a persistent scheduler.**

  Prefer a system-level timer or root cron if the operator has that permission. If not, install the watchdog in the `sunhao` user's crontab at one-minute intervals; the script must work after logout and must not rely on user systemd because `Linger=no`. Document the exact install, remove, and dry-run commands.

- [ ] **Step 5: Run the tests and a dry run.**

  Run `node --test tests/foldbridge-host15-ops.test.mjs` locally. On Host 15 run the watchdog in `--dry-run` mode, confirm it sees four ready connections, and confirm no restart occurs. Then run it once against a fixture with zero connections and confirm it records the planned action without executing Docker.

### Task 3: Upgrade and test the transport deliberately

**Files:**
- Modify: `scripts/foldbridge-host15-services.sh`
- Modify: `tests/foldbridge-host15-ops.test.mjs`
- Modify: `docs/runbooks/foldbridge-host15-tunnel-runbook.md`

**Interfaces:**
- Consumes: the guarded service recreation from Task 2.
- Produces: a tested cloudflared image/protocol choice and a documented rollback.

- [ ] **Step 1: Pin the intended cloudflared version.**

  Upgrade from the observed `2026.8.2` to the currently approved image tag after checking the image digest and release notes. The current connector itself reports that `2026.10.0` is recommended. Record the selected tag and digest in the runbook.

- [ ] **Step 2: Test protocol `auto` in a controlled window.**

  Cloudflare documents `auto` as preferring QUIC and falling back to HTTP/2. Start with `auto`, verify the registered protocol and four connections, then run repeated local/public probes for at least 15 minutes. If UDP is blocked or stability worsens, roll back to `http2` and record the evidence. Do not change DNS during this experiment.

- [ ] **Step 3: Recreate the container and verify.**

  Run `/home/sunhao/.local/bin/foldbridge-host15-services up`, verify image/version, `/ready`, `/metrics`, container restart count, local origin, test hostname, production hostname, CORS, and a real `.gz` asset. Expected: four ready connections, no container restart, and successful probes.

- [ ] **Step 4: Keep rollback explicit.**

  Document the previous image tag, protocol, and exact recreation command. Rollback must be possible without changing the tunnel token or DNS record.

### Task 4: Add an external maintenance fallback to the FoldBridge portal

**Files:**
- Create: `src/entryCaseFallback.js`
- Modify: `src/entryCaseEmbed.js`
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Create or modify: `public/maintenance.html` only if the existing repository copy is found during implementation
- Modify: `test/entry-case-embed.test.js`
- Modify: `package.json` only if a build smoke script is needed

**Interfaces:**
- Consumes: the existing case iframe element, `foldbridge.sunhao.uk` frame origin, and the existing loading indicator lifecycle.
- Produces: a static portal-side fallback panel with retry action and a stable status message; no dependency on Host 15 for rendering the fallback.

- [ ] **Step 1: Locate and verify the claimed existing maintenance page.**

  Search the repository's current main, Pages artifact, and any deployment source available to the operator for the existing `foldbridge` maintenance asset. Record its exact path, build inclusion rule, and whether it is served by GitHub Pages. If no dedicated asset exists, use a small inline/static fallback component in the portal and record that finding; do not duplicate an unverified page.

- [ ] **Step 2: Write failing DOM-contract tests.**

  Add tests that assert: loading is visible before iframe load; successful iframe load hides both loading and fallback; iframe error shows fallback with a retry control; retry recreates or reloads the iframe; a case URL with a known 404 marker can show case-not-found copy instead of site maintenance; and the fallback contains no `sunhao.uk` asset dependency.

- [ ] **Step 3: Implement the fallback lifecycle.**

  Extend the existing `mountEntryCaseLoadingIndicator` contract with a companion failure/retry controller. Use the iframe `error` event plus a bounded load timeout; do not rely on cross-origin inspection of the child document. Keep the fallback in the GitHub Pages portal DOM, with accessible `role="status"`, a retry button, and a link back to the entry table. Preserve the current trusted `postMessage` and frame-origin checks.

- [ ] **Step 4: Add focused styling and copy.**

  Add styles in `src/styles.css` matching the existing portal tokens. The message should say that case data is temporarily unavailable and suggest retrying; it must not expose Docker, tunnel IDs, internal IPs, or operator details.

- [ ] **Step 5: Run build and browser-level smoke checks.**

  Run `npm test` and the production build. In a browser, verify one successful case, one intentionally invalid case, and a simulated unreachable `foldbridge.sunhao.uk` frame. Confirm the portal remains usable and the maintenance panel is served from the Pages origin.

### Task 5: Release, monitoring, and rollback

**Files:**
- Modify: `docs/runbooks/foldbridge-host15-tunnel-runbook.md`
- Modify: `docs/网站更新手册_DEPLOYMENT_HANDBOOK.md`
- Modify: `.github/workflows/pages.yml` or the repository's current Pages workflow only if the maintenance asset needs explicit inclusion

**Interfaces:**
- Consumes: the watchdog and portal fallback from Tasks 2–4.
- Produces: an operator runbook with alert thresholds, release gates, and rollback steps.

- [ ] **Step 1: Add alerting and evidence collection.**

  Document Cloudflare Tunnel Health notifications and the local watchdog log. Cloudflare's tunnel status distinguishes `Healthy`, `Degraded`, and `Down`; use those states with `/ready`, origin probes, and public probes rather than relying on container state alone.

- [ ] **Step 2: Define release gates.**

  Require: image/version recorded; four ready connections; local origin 200; test hostname 200/204/CORS; production hostname 200/204/CORS; `.gz` response without `Content-Encoding: gzip`; portal fallback smoke test; and no unexpected container restart during the observation window.

- [ ] **Step 3: Document rollback.**

  Roll back the image/protocol and restart the tunnel container if connector health regresses. Roll back the portal commit if the fallback changes normal case routing. Keep DNS unchanged unless an operator separately performs the existing manual Mac cutover.

- [ ] **Step 4: Commit and publish in separate changes.**

  Commit the watchdog/service/runbook change separately from the portal fallback. Publish the portal through the existing GitHub Pages workflow. Apply Host 15 changes through the existing service script, then verify the test hostname before production validation.

## Completion Criteria

- A four-connection loss is detected within three minutes and causes at most one guarded restart per cooldown window.
- The watchdog survives logout, records why it acted, and stops after the configured hourly restart cap.
- cloudflared runs the selected current version and a protocol choice justified by the observation window.
- The portal shows a useful maintenance fallback when Host 15 is unreachable, while valid cases and case-level 404s keep their expected behavior.
- Runbook commands and rollback steps are reproducible by another operator without exposing secrets.

