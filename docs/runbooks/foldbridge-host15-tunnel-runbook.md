# FoldBridge Host 15 Tunnel 运维手册

## 当前边界

- 正式域名 `foldbridge.sunhao.uk` 已于 2026-09-16 切到 Host 15 Tunnel。
- Host 15 Tunnel 名为 `foldbridge-host15`，ID 为 `3a025f88-32a2-48e6-adf1-794e6aaa86ce`。
- 测试域名 `foldbridge-host15.sunhao.uk` 指向 Host 15 Tunnel。
- Host 15 静态根目录为 `/home/sunhao/Server15/public`。
- 源站仅监听 `127.0.0.1:8888`，公网只能通过 Cloudflare Tunnel 访问。
- Mac Tunnel ID 为 `f2755002-1253-453e-8d31-be64bc44f51f`，保持运行作为手动热备。

## Host 15 运行结构

| 组件 | 运行方式 | 关键路径 |
| --- | --- | --- |
| CORS 静态源站 | Docker `foldbridge-host15-origin` | `/home/sunhao/.local/lib/foldbridge/cors_static_server.py` |
| 静态数据 | 只读挂载到源站容器 | `/home/sunhao/Server15/public` |
| Tunnel connector | Docker `foldbridge-host15-cloudflared` | `/home/sunhao/.cloudflared/foldbridge-host15.token` |
| 重建脚本 | Host 15 本地脚本 | `/home/sunhao/.local/bin/foldbridge-host15-services` |

两个容器均使用 `--restart unless-stopped`。Host 15 的 Docker 服务已设置为开机启动。

自愈边界：

- Host 15 重启后，systemd 自动启动 Docker，Docker 自动恢复两个容器。
- 容器主进程退出时，Docker 自动重启容器。
- 源站每 30 秒检查一次 `127.0.0.1:8888`；检查失败会终止源站 PID 1，再由 Docker 拉起。
- cloudflared 生产默认使用 HTTP/2 维持四条边缘连接并自动重连；2026-10-13 的 `auto`/QUIC 窗口测试出现 `no recent network activity` 和 2/4 连接，已回滚到 HTTP/2。需要实验时显式设置 `FOLDBRIDGE_HOST15_TUNNEL_PROTOCOL=auto`；进程退出时由 Docker 拉起。
- Mac 与 Host 15 之间不自动切流。正式源站故障时使用本手册的回切命令，避免两端数据版本不一致时自动漂移。

连接级 watchdog（2026-10-12 起）：

- cloudflared 通过 `127.0.0.1:20241/ready` 和 `/metrics` 暴露连接状态；正常状态为 `readyConnections=4` 与 `cloudflared_tunnel_ha_connections 4`。
- `/ready` 或 HA 连接数为 0 连续三次才触发动作，避免单条边缘连接重连造成误重启。
- watchdog 使用 `flock`、10 分钟冷却和每小时最多 3 次重启；每次动作写入 `/home/sunhao/.local/state/foldbridge-host15-watchdog/watchdog.log`。
- origin 探针与 tunnel 探针分开记录。origin 返回非 200 时只报告源站异常，不把它误判为 tunnel 断线。
- `/ready` 失败但容器仍为 `running` 时，watchdog 才会主动 `docker restart foldbridge-host15-cloudflared`；Docker 的 `restart=unless-stopped` 仍负责进程退出后的恢复。

安装或更新 watchdog（Host 15）：

```bash
install -m 0755 scripts/foldbridge-host15-watchdog.sh \
  /home/sunhao/.local/bin/foldbridge-host15-watchdog
mkdir -p /home/sunhao/.local/state/foldbridge-host15-watchdog
(crontab -l 2>/dev/null | grep -v 'foldbridge-host15-watchdog' || true; \
  echo '* * * * * /home/sunhao/.local/bin/foldbridge-host15-watchdog >/dev/null 2>&1') | crontab -
```

检查 watchdog：

```bash
/home/sunhao/.local/bin/foldbridge-host15-watchdog
tail -n 20 /home/sunhao/.local/state/foldbridge-host15-watchdog/watchdog.log
curl -sS http://127.0.0.1:20241/ready
curl -sS http://127.0.0.1:20241/diag/tunnel
```

watchdog 不应在正常的 `readyConnections=4` 状态下重启容器。需要演练时使用 `FOLDBRIDGE_HOST15_WATCHDOG_DRY_RUN=1`，不要伪造生产连接状态或手动删除状态文件。

Tunnel token 必须保持 `0600`，并且不能放入 `/home/sunhao/Server15/public`。该目录是静态 docroot，也可能被同步命令的 `--delete` 清理。

## 日常检查

在本机执行：

```bash
ssh 15 /home/sunhao/.local/bin/foldbridge-host15-services status
scripts/foldbridge-host15-switch.sh check /
```

测试域名和正式域名都必须通过。发布新内容时，先同步并验收测试域名，再验收正式域名。

查看日志：

```bash
ssh 15 'docker logs --tail 100 foldbridge-host15-origin'
ssh 15 'docker logs --tail 100 foldbridge-host15-cloudflared'
```

重新创建两个容器：

```bash
ssh 15 /home/sunhao/.local/bin/foldbridge-host15-services up
```

## 同步完成后的验收

先选一个两端都存在的真实 case，例如：

```bash
PROBE=/entry-cases/cases/9ZC6/index.html
scripts/foldbridge-host15-switch.sh check "$PROBE"
```

验收必须同时满足：

1. Host 15 测试域名 GET 为 200。
2. OPTIONS 为 204。
3. GET 和 OPTIONS 都含有效的 `Access-Control-Allow-Origin`。
4. `.gz` 文件没有 `Content-Encoding: gzip`，浏览器需要读取原始 gzip 字节后自行解压。
5. Mac 源文件与 Host 15 文件的 SHA-256 一致。
6. 至少打开一个真实 case 页面，确认 1D、2D、3D 资源均能加载。

哈希示例：

```bash
shasum -a 256 /Volumes/tianyi/Server/public/entry-cases/cases/9ZC6/case.json
ssh 15 sha256sum /home/sunhao/Server15/public/entry-cases/cases/9ZC6/case.json
```

`.gz` 响应头示例：

```bash
curl -sSI -H 'Origin: https://foldbridge.ribocentre.org' \
  https://foldbridge-host15.sunhao.uk/entry-cases/cases/9ZC6/chains/A/ef-matrix.json.gz
```

## 手动切换与回切

只有同步完成并通过上述验收后才能执行：

```bash
scripts/foldbridge-host15-switch.sh host15 /entry-cases/cases/9ZC6/index.html
```

该命令先检查 Host 15 测试域名；检查失败时不会修改正式 DNS。切换后会立即检查正式域名。

回切 Mac：

```bash
scripts/foldbridge-host15-switch.sh mac /entry-cases/cases/9ZC6/index.html
```

Mac Tunnel ID 固定记录在切换脚本中。Host 15 为当前正式源；Mac Tunnel 和源站继续运行，确保可以立即手动回切。

## 2026-09-16 正式切换记录

- `/Volumes/tianyi/Server/public` 到 `/home/sunhao/Server15/public` 的 `9*` 生产 case checksum dry-run 检查了 39,319 个文件，传输数为 0。
- 9ZC6、9TMI 的 GET 为 200，OPTIONS 为 204，CORS 正常。
- `9TMI/chains/A/ef-matrix.json.gz` 返回 `Content-Type: application/gzip`，没有错误的 `Content-Encoding: gzip`。
- 03:30:17 UTC，`cloudflared tunnel route dns --overwrite-dns` 将正式域名路由到 Tunnel `3a025f88-32a2-48e6-adf1-794e6aaa86ce`。
- 03:46:52 UTC，带唯一查询标记的正式域名请求出现在 `foldbridge-host15-origin` 日志中，确认实际流量落到 Host 15，而不是只观察 DNS 配置。
- 切换后源站为 `healthy`，源站和 Tunnel 容器 restart count 均为 0。

后续要求：持续保持 Mac 热备可用；每次发布同时更新 Host 15 和 Mac 热备并做 checksum；不启用自动 DNS 漂移。

## 2026-10-13 UTC 发布验收

- cloudflared 从 `2026.8.2` 升级到 `2026.10.0`；Docker 镜像 digest 为 `sha256:9b49eed8f62806d5d45ddf59ecefb5710429598ea6d3fcccd2af938f621b2b07`。
- `auto` 成功注册 QUIC，但很快出现连接/控制流超时、仅 2/4 条连接和 `no recent network activity`。未把 QUIC 视为稳定。
- 03:09 UTC 回滚传输协议为 HTTP/2，保留新版本；03:09:04 UTC 四条连接完成注册，watchdog 后续持续观察到 4/4。
- 服务脚本默认值已持久化为 HTTP/2，`up` 不会重新进入 QUIC；想测试 `auto` 时必须显式覆盖。
- watchdog 每分钟运行，连续三次全断才允许重启，重启失败也记账及冷却，origin 单独探测。metrics 仅绑定 `127.0.0.1:20241`。
- 门户维护卡片和 `maintenance.html` 由 GitHub Pages 托管。用受信的 case 高度/ready 消息以及带 CORS 的 HEAD 验证 iframe；503/隧道异常显示英文维护提示，404 显示 `Case page not found`。重试保持 PDB、chain、family，终止过期探针。
- 此次没有替换 Host 15/Mac served store 的 case 数据或共享脚本；门户兼容线上现有高度消息。

回滚/停止 watchdog（保留其他 cron 条目）：

```bash
(crontab -l | grep -v '/home/sunhao/.local/bin/foldbridge-host15-watchdog' || true) | crontab -
```

暂不升级版本的回退：在服务脚本的 `TUNNEL_IMAGE` 恢复为 `cloudflare/cloudflared:2026.8.2`、协议保持 HTTP/2，再执行 `up`。这会短暂重建容器，先保存脚本和确认镜像存在。回退不改 token 或 DNS。
