# 免费托管平台对照表

## Node.js 托管

| 平台 | 网址 | 免费模式 | 是否需信用卡 | 是否易休眠 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Belmo | https://belmo.io | 免费 Node 服务 | 否 | 否 | 强调 24/7，带 HTTPS，适合常驻后端 |
| Bonto | https://bonto.dev | 免费 Node.js 托管 | 否 | 15 分钟无访问休眠 | 你当前在用，无需信用卡 |
| HidenCloud | https://www.hidencloud.com/service/free-node-hosting | 免费 Node.js 托管 | 否 | 未明确 | 免费，但每周需手动续期 |

## Docker 托管

| 平台 | 网址 | 免费模式 | 是否需信用卡 | 是否易休眠 | 备注 |
| --- | --- | --- | --- | --- | --- |
| FreeHost.run | https://www.freehost.run/docker | 免费 Docker 托管 | 否 | 未明确 | 声明长期免费，支持自定义容器 |
| SnapDeploy | https://snapdeploy.dev/free-container-hosting | 每天 10 次免费部署 | 否 | 空闲自动休眠 | 访问时自动唤醒，适合轻量服务 |
| Offly | https://offly.pagekite.me | 免费 Docker 容器 | 否 | 未明确 | 提供 SSH，适合跑常驻服务 |
| APPISH | https://appi.sh | 免费 2 小时演示容器 | 否 | 2 小时后结束 | 最快试用，适合临时验证 |

## 选择建议

- 优先保持服务不睡眠：选 **Belmo**
- 优先 Docker 部署：选 **FreeHost.run**
- 优先简单快速验证：选 **APPISH**
- 继续当前方案：继续用 **Bonto**，配合 UptimeRobot 保活

---

# Offly 部署指南（推荐）

本项目前后端已合并，只需一个 Offly 容器即可运行完整服务。

## 1. 注册 Offly

1. 打开 https://offly.pagekite.me
2. 点击注册并创建账户
3. 不需要信用卡

## 2. 创建容器

1. 登录后进入控制台
2. 点击 **New Container**
3. 给你的容器起一个名字，例如 `my-node-server`
4. 选择基础镜像或使用默认镜像

## 3. 上传项目文件

你有两种方式上传代码：

### 方式 A：通过 Offly 文件管理器上传
1. 进入容器详情页
2. 打开 **File Explorer**
3. 上传以下文件：
   - `index.js`
   - `package.json`
   - `index.html`
   - `style.css`
   - `Dockerfile`（可选）

### 方式 B：通过 Cloud Terminal 克隆仓库
1. 打开 **Cloud Terminal**
2. 执行：
```bash
cd /app
 git clone <your-repo-url> .
```

## 4. 安装依赖

在 **Cloud Terminal** 中执行：
```bash
npm install
```

如果安装成功，会看到 `node_modules` 目录生成。

## 5. 启动服务

在 **Cloud Terminal** 中执行：
```bash
node index.js
```

看到以下日志说明启动成功：
```
Server is running on port 3000
```

## 6. 配置环境变量

1. 在容器设置中找到 **Environment Variables**
2. 添加以下变量：

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| UUID | 节点 UUID | `a1a85839-2065-47e6-b3d0-79f77daa407a` |
| NEZHA_SERVER | 哪吒服务器地址 | `nz.abc.com:8008` |
| NEZHA_PORT | Nezha agent 端口 | `443` |
| NEZHA_KEY | 哪吒密钥或端口 | `your-secret` |
| DOMAIN | Offly 容器域名 | `offly.pagekite.me` |
| AUTO_ACCESS | 自动保活 | `false` |
| WSPATH | WebSocket 路径 | 留空则自动取 UUID 前 8 位 |
| SUB_PATH | 订阅路径 | `sub` |
| SUB1_PATH | FlClash 订阅路径 | `sub1` |
| NAME | 节点名称 | `MyNode` |
| PORT | 服务端口 | `3000` |

### 你的容器信息

- API Key: `yLHRLrpg8X1t7buy1aOC0AGHfbU1yaht`
- Container Name: `whj`
- 容器访问地址: `https://offly.pagekite.me/containers/yLHRLrpg8X1t7buy1aOC0AGHfbU1yaht/whj/3000`
- `DOMAIN` 环境变量填: `offly.pagekite.me`

### 如何填写 DOMAIN

Offly 容器域名通常格式为：
```
https://offly.pagekite.me/containers/<API_KEY>/<CONTAINER_NAME>/3000
```

`DOMAIN` 环境变量只填域名部分，例如：
```
offly.pagekite.me
```

如果不确定，可以先访问容器 URL，然后把域名部分填到 `DOMAIN` 中。

## 7. 获取访问地址

1. 在 Offly 控制台查看你的容器地址
2. 一般格式为：
```
https://offly.pagekite.me/containers/<API_KEY>/<CONTAINER_NAME>/3000
```
3. 这个地址就是你的完整服务地址

## 8. 测试访问

打开浏览器访问：

- 首页：`https://<your-offly-domain>/`
- 普通订阅：`https://<your-offly-domain>/sub`
- FlClash 订阅：`https://<your-offly-domain>/sub1`
- WebSocket：`wss://<your-offly-domain>/<WSPATH>`

## 9. 常见问题

### 服务启动失败
- 检查 Cloud Terminal 里的错误日志
- 确认 `npm install` 已成功
- 确认 `PORT` 环境变量为 `3000`

### 订阅无法访问
- 确认容器已运行且端口为 3000
- 确认环境变量 `DOMAIN` 已正确填写
- 确认 `/sub` 和 `/sub1` 路径没有拼写错误

### 容器休眠
- Offly 免费容器可能在无访问时休眠
- 建议用 UptimeRobot 每 5 分钟访问一次首页保持唤醒

### 如何修改代码后重新生效
- 修改 `index.js` 后，在 Cloud Terminal 里重新运行：
```bash
node index.js
```
- 如果有 `pm2` 之类的进程管理工具也可使用

## 10. 保活建议

如果 Offly 容器出现自动休眠，可以：
1. 使用 UptimeRobot 定时 ping 你的容器首页
2. 定时访问 `/sub` 或 `/sub1`
3. 保持容器最小可用配置，减少内存占用
```
