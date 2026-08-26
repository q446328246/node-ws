#!/usr/bin/env node

// ================= 依赖引入 =================
const os = require('os');
const http = require('http');
const fs = require('fs');
const axios = require('axios');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { Buffer } = require('buffer');
const { exec, execSync } = require('child_process');
const { WebSocket, createWebSocketStream } = require('ws');

// ================= 基础配置 =================
// 节点 UUID，用于生成订阅和校验客户端请求
const UUID = process.env.UUID || 'a1a85839-2065-47e6-b3d0-79f77daa407a';
// 哪吒监控服务器地址
const NEZHA_SERVER = process.env.NEZHA_SERVER || '';
// 哪吒 agent 端口，仅 v0 使用
const NEZHA_PORT = process.env.NEZHA_PORT || '';
// 哪吒 v1 的 client_secret，或 v0 的 agent 端口
const NEZHA_KEY = process.env.NEZHA_KEY || '';
// 当前项目域名，用于生成订阅地址
const DOMAIN = process.env.DOMAIN || 'whj.bonto.run';
// 是否自动访问保活
const AUTO_ACCESS = process.env.AUTO_ACCESS || true;
// WebSocket 路径，默认取 UUID 前 8 位
const WSPATH = process.env.WSPATH || UUID.slice(0, 8);
// 默认订阅路径
const SUB_PATH = process.env.SUB_PATH || 'sub';
// FlClash 订阅路径
const SUB1_PATH = process.env.SUB1_PATH || 'sub1';
// 节点名称
const NAME = process.env.NAME || '';
// HTTP / WS 服务端口
const PORT = process.env.PORT || 3000;

// ================= 哪吒相关路径 =================
// 使用独立临时目录存放 nezha 二进制和配置，避免相对路径和清理冲突
const CONFIG_DIR = path.join(os.tmpdir(), 'nezha-' + process.pid);
const NZ_BIN = path.join(CONFIG_DIR, 'npm');
const NZ_CONFIG = path.join(CONFIG_DIR, 'config.yaml');

let uuid = UUID.replace(/-/g, ""), CurrentDomain = DOMAIN, Tls = 'tls', CurrentPort = 443, ISP = '';
// DNS 服务列表，用于自定义域名解析
const DNS_SERVERS = ['8.8.4.4', '1.1.1.1'];
// 测速域名黑名单，避免代理到测速站点
const BLOCKED_DOMAINS = [
  'speedtest.net', 'fast.com', 'speedtest.cn', 'speed.cloudflare.com', 'speedof.me',
   'testmy.net', 'bandwidth.place', 'speed.io', 'librespeed.org', 'speedcheck.org'
];

// 判断域名是否在测速黑名单中
function isBlockedDomain(host) {
  if (!host) return false;
  const hostLower = host.toLowerCase();
  return BLOCKED_DOMAINS.some(blocked => {
    return hostLower === blocked || hostLower.endsWith('.' + blocked);
  });
}

// 获取运营商信息，用于订阅节点名称
async function getisp() {
  try {
    const res = await axios.get('https://api.ip.sb/geoip', { headers: { 'User-Agent': 'Mozilla/5.0', timeout: 3000 }});
    const data = res.data;
    ISP = `${data.country_code}-${data.isp}`.replace(/ /g, '_');
  } catch (e) {
    try {
      const res2 = await axios.get('http://ip-api.com/json', { headers: { 'User-Agent': 'Mozilla/5.0', timeout: 3000 }});
      const data2 = res2.data;
      ISP = `${data2.countryCode}-${data2.org}`.replace(/ /g, '_');
    } catch (e2) {
      ISP = 'Unknown';
    }
  }
}

// 获取当前服务器 IP 或直接使用配置域名
async function getip() {
  if (!DOMAIN || DOMAIN === 'your-domain.com') {
      try {
          const res = await axios.get('https://api-ipv4.ip.sb/ip', { timeout: 5000 });
          const ip = res.data.trim();
          CurrentDomain = ip, Tls = 'none', CurrentPort = PORT;
      } catch (e) {
          console.error('Failed to get IP', e.message);
          CurrentDomain = 'cahnge-your-domain.com', Tls = 'tls', CurrentPort = 443;
      }
  } else {
      CurrentDomain = DOMAIN, Tls = 'tls', CurrentPort = 443;
  }
}

// ================= HTTP 路由 =================
// 首页返回静态页面；/sub 返回 base64 订阅；/sub1 返回 FlClash YAML 订阅
const httpServer = http.createServer(async (req, res) => {
  if (req.url === '/') {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('Hello world!');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
    return;
  } else if (req.url === `/${SUB_PATH}`) {
    await getisp();await getip();
    const namePart = NAME ? `${NAME}-${ISP}` : ISP;
    const tlsParam = Tls === 'tls' ? 'tls' : 'none';
    const ssTlsParam = Tls === 'tls' ? 'tls;' : '';
    const vlsURL = `vless://${UUID}@${CurrentDomain}:${CurrentPort}?encryption=none&security=${tlsParam}&sni=${CurrentDomain}&fp=chrome&type=ws&host=${CurrentDomain}&path=%2F${WSPATH}#${namePart}`;
    const troURL = `trojan://${UUID}@${CurrentDomain}:${CurrentPort}?security=${tlsParam}&sni=${CurrentDomain}&fp=chrome&type=ws&host=${CurrentDomain}&path=%2F${WSPATH}#${namePart}`;
    const ssMethodPassword = Buffer.from(`none:${UUID}`).toString('base64');
    const ssURL = `ss://${ssMethodPassword}@${CurrentDomain}:${CurrentPort}?plugin=v2ray-plugin;mode%3Dwebsocket;host%3D${CurrentDomain};path%3D%2F${WSPATH};${ssTlsParam}sni%3D${CurrentDomain};skip-cert-verify%3Dtrue;mux%3D0#${namePart}`;
    const subscription = vlsURL + '\n' + troURL + '\n' + ssURL;
    const base64Content = Buffer.from(subscription).toString('base64');

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(base64Content + '\n');
  } else if (req.url === `/${SUB1_PATH}`) {
    await getisp();await getip();
    const namePart = NAME ? `${NAME}-${ISP}` : ISP;
    const tlsParam = Tls === 'tls' ? 'true' : 'false';
    const wsPath = `/${WSPATH}`;
    const vlessProxy = `  - name: "${namePart}-vless"
    type: vless
    server: ${CurrentDomain}
    port: ${CurrentPort}
    uuid: ${UUID}
    udp: true
    tls: ${tlsParam}
    skip-cert-verify: true
    servername: ${CurrentDomain}
    network: ws
    ws-opts:
      path: ${wsPath}
      headers:
        Host: ${CurrentDomain}`;
    const trojanProxy = `  - name: "${namePart}-trojan"
    type: trojan
    server: ${CurrentDomain}
    port: ${CurrentPort}
    password: ${UUID}
    udp: true
    sni: ${CurrentDomain}
    skip-cert-verify: true
    network: ws
    ws-opts:
      path: ${wsPath}
      headers:
        Host: ${CurrentDomain}`;
    const ssMethodPassword = Buffer.from(`none:${UUID}`).toString('base64');
    const ssProxy = `  - name: "${namePart}-ss"
    type: ss
    server: ${CurrentDomain}
    port: ${CurrentPort}
    cipher: none
    password: ${UUID}
    plugin: v2ray-plugin
    plugin-opts:
      mode: websocket
      host: ${CurrentDomain}
      path: ${wsPath}
      tls: ${tlsParam}
      skip-cert-verify: true
      sni: ${CurrentDomain}
      mux: 0`;
    const proxyNames = [
      `${namePart}-vless`,
      `${namePart}-trojan`,
      `${namePart}-ss`
    ];
    const clashYaml = `proxies:\n${vlessProxy}\n${trojanProxy}\n${ssProxy}\nproxy-groups:\n  - name: "${namePart}"
    type: select
    proxies:\n${proxyNames.map(name => `      - ${name}`).join('\n')}\nrules:\n  - MATCH,${namePart}`;

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(clashYaml + '\n');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n');
  }
});

// ================= 自定义 DNS 解析 =================
// 先判断是否为 IP；如果不是，则依次尝试 Google DNS over HTTPS
function resolveHost(host) {
  return new Promise((resolve, reject) => {
    if (/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(host)) {
      resolve(host);
      return;
    }
    let attempts = 0;
    function tryNextDNS() {
      if (attempts >= DNS_SERVERS.length) {
        reject(new Error(`Failed to resolve ${host} with all DNS servers`));
        return;
      }
      const dnsServer = DNS_SERVERS[attempts];
      attempts++;
      const dnsQuery = `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`;
      axios.get(dnsQuery, {
        timeout: 5000,
        headers: {
          'Accept': 'application/dns-json'
        }
      })
        .then(response => {
          const data = response.data;
          if (data.Status === 0 && data.Answer && data.Answer.length > 0) {
            const ip = data.Answer.find(record => record.type === 1);
            if (ip) {
              resolve(ip.data);
              return;
            }
          }
          tryNextDNS();
        })
        .catch(error => {
          tryNextDNS();
        });
    }

    tryNextDNS();
  });
}

// ================= VLESS / SS 处理 =================
// 处理 VLESS + SS 混合格式的 WebSocket 连接
function handleVlsConnection(ws, msg) {
  const [VERSION] = msg;
  const id = msg.slice(1, 17);
  if (!id.every((v, i) => v == parseInt(uuid.substr(i * 2, 2), 16))) return false;

  let i = msg.slice(17, 18).readUInt8() + 19;
  const port = msg.slice(i, i += 2).readUInt16BE(0);
  const ATYP = msg.slice(i, i += 1).readUInt8();
  const host = ATYP == 1 ? msg.slice(i, i += 4).join('.') :
    (ATYP == 2 ? new TextDecoder().decode(msg.slice(i + 1, i += 1 + msg.slice(i, i + 1).readUInt8())) :
      (ATYP == 3 ? msg.slice(i, i += 16).reduce((s, b, i, a) => (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s), []).map(b => b.readUInt16BE(0).toString(16)).join(':') : ''));

  if (isBlockedDomain(host)) {
    ws.close();
    return false;
  }
  ws.send(new Uint8Array([VERSION, 0]));
  const duplex = createWebSocketStream(ws);
  resolveHost(host)
    .then(resolvedIP => {
      net.connect({ host: resolvedIP, port }, function () {
        this.write(msg.slice(i));
        duplex.on('error', () => { }).pipe(this).on('error', () => { }).pipe(duplex);
      }).on('error', () => { });
    })
    .catch(error => {
      net.connect({ host, port }, function () {
        this.write(msg.slice(i));
        duplex.on('error', () => { }).pipe(this).on('error', () => { }).pipe(duplex);
      }).on('error', () => { });
    });

  return true;
}

// ================= Trojan 处理 =================
// 处理 Trojan 协议的 WebSocket 连接
function handleTrojConnection(ws, msg) {
  try {
    if (msg.length < 58) return false;
    const receivedPasswordHash = msg.slice(0, 56).toString();
    const possiblePasswords = [UUID];

    let matchedPassword = null;
    for (const pwd of possiblePasswords) {
      const hash = crypto.createHash('sha224').update(pwd).digest('hex');
      if (hash === receivedPasswordHash) {
        matchedPassword = pwd;
        break;
      }
    }

    if (!matchedPassword) return false;
    let offset = 56;
    if (msg[offset] === 0x0d && msg[offset + 1] === 0x0a) {
      offset += 2;
    }

    const cmd = msg[offset];
    if (cmd !== 0x01) return false;
    offset += 1;
    const atyp = msg[offset];
    offset += 1;
    let host, port;
    if (atyp === 0x01) {
      host = msg.slice(offset, offset + 4).join('.');
      offset += 4;
    } else if (atyp === 0x03) {
      const hostLen = msg[offset];
      offset += 1;
      host = msg.slice(offset, offset + hostLen).toString();
      offset += hostLen;
    } else if (atyp === 0x04) {
      host = msg.slice(offset, offset + 16).reduce((s, b, i, a) =>
        (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s), [])
        .map(b => b.readUInt16BE(0).toString(16)).join(':');
      offset += 16;
    } else {
      return false;
    }

    port = msg.readUInt16BE(offset);
    offset += 2;

    if (offset < msg.length && msg[offset] === 0x0d && msg[offset + 1] === 0x0a) {
      offset += 2;
    }

    if (isBlockedDomain(host)) {
      ws.close();
      return false;
    }
    const duplex = createWebSocketStream(ws);
    resolveHost(host)
      .then(resolvedIP => {
        net.connect({ host: resolvedIP, port }, function () {
          if (offset < msg.length) {
            this.write(msg.slice(offset));
          }
          duplex.on('error', () => { }).pipe(this).on('error', () => { }).pipe(duplex);
        }).on('error', () => { });
      })
      .catch(error => {
        net.connect({ host, port }, function () {
          if (offset < msg.length) {
            this.write(msg.slice(offset));
          }
          duplex.on('error', () => { }).pipe(this).on('error', () => { }).pipe(duplex);
        }).on('error', () => { });
      });

    return true;
  } catch (error) {
    return false;
  }
}

// ================= SS 处理 =================
// 处理 Shadowsocks 协议的 WebSocket 连接
function handleSsConnection(ws, msg) {
  try {
    let offset = 0;
    const atyp = msg[offset];
    offset += 1;

    let host, port;
    if (atyp === 0x01) {
      host = msg.slice(offset, offset + 4).join('.');
      offset += 4;
    } else if (atyp === 0x03) {
      const hostLen = msg[offset];
      offset += 1;
      host = msg.slice(offset, offset + hostLen).toString();
      offset += hostLen;
    } else if (atyp === 0x04) {
      host = msg.slice(offset, offset + 16).reduce((s, b, i, a) =>
        (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s), [])
        .map(b => b.readUInt16BE(0).toString(16)).join(':');
      offset += 16;
    } else {
      return false;
    }

    port = msg.readUInt16BE(offset);
    offset += 2;

    if (isBlockedDomain(host)) {
      ws.close();
      return false;
    }
    const duplex = createWebSocketStream(ws);
    resolveHost(host)
      .then(resolvedIP => {
        net.connect({ host: resolvedIP, port }, function () {
          if (offset < msg.length) {
            this.write(msg.slice(offset));
          }
          duplex.on('error', () => { }).pipe(this).on('error', () => { }).pipe(duplex);
        }).on('error', () => { });
      })
      .catch(error => {
        net.connect({ host, port }, function () {
          if (offset < msg.length) {
            this.write(msg.slice(offset));
          }
          duplex.on('error', () => { }).pipe(this).on('error', () => { }).pipe(duplex);
        }).on('error', () => { });
      });

    return true;
  } catch (error) {
    return false;
  }
}

// ================= WebSocket 服务 =================
// 统一处理 VLESS、Trojan、SS 三种协议的接入请求
const wss = new WebSocket.Server({ server: httpServer });
wss.on('connection', (ws, req) => {
  const url = req.url || '';

  const expectedPath = `/${WSPATH}`;
  if (!url.startsWith(expectedPath)) {
    ws.close();
    return;
  }

  ws.once('message', msg => {
    // VLE-SS (version byte 0 + 16 bytes UUID)
    if (msg.length > 17 && msg[0] === 0) {
      const id = msg.slice(1, 17);
      const isVless = id.every((v, i) => v == parseInt(uuid.substr(i * 2, 2), 16));
      if (isVless) {
        if (!handleVlsConnection(ws, msg)) {
          ws.close();
        }
        return;
      }
    }
    // tro-jan (56 bytes SHA224 hash)
    if (msg.length >= 58) {
      if (handleTrojConnection(ws, msg)) {
        return;
      }
    }
    // SS (ATYP开头: 0x01, 0x03, 0x04)
    if (msg.length > 0 && (msg[0] === 0x01 || msg[0] === 0x03 || msg[0] === 0x04)) {
      if (handleSsConnection(ws, msg)) {
        return;
      }
    }

    ws.close();
  }).on('error', () => { });
});

const getDownloadUrl = () => {
  const arch = os.arch();
  if (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') {
    if (!NEZHA_PORT) {
      return 'https://arm64.ssss.nyc.mn/v1';
    } else {
      return 'https://arm64.ssss.nyc.mn/agent';
    }
  } else {
    if (!NEZHA_PORT) {
      return 'https://amd64.ssss.nyc.mn/v1';
    } else {
      return 'https://amd64.ssss.nyc.mn/agent';
    }
  }
};

// ================= 下载 nezha agent =================
// 根据当前架构下载对应版本的 nezha agent 二进制文件
const downloadFile = async () => {
  if (!NEZHA_SERVER && !NEZHA_KEY) return;

  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    const url = getDownloadUrl();
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(NZ_BIN);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('npm download successfully');
        fs.chmodSync(NZ_BIN, '755');
        resolve();
      });
      writer.on('error', reject);
    });
  } catch (err) {
    throw err;
  }
};

// ================= 启动 nezha =================
// 若 nezha 配置完整，则下载 agent 并后台启动；仅 v0 模式会写入 config.yaml
const runnz = async () => {
  try {
    const status = execSync('ps aux | grep -v "grep" | grep "./[n]pm"', { encoding: 'utf-8' });
    if (status.trim() !== '') {
      console.log('npm is already running, skip running...');
      return;
    }
  } catch (e) {
    // 进程不存在时继续运行nezha
  }

  if (!NEZHA_SERVER || !NEZHA_KEY) return;

  await downloadFile();
  let command = '';
  let tlsPorts = ['443', '8443', '2096', '2087', '2083', '2053'];
  if (NEZHA_SERVER && NEZHA_PORT && NEZHA_KEY) {
    const NEZHA_TLS = tlsPorts.includes(NEZHA_PORT) ? '--tls' : '';
    command = `nohup \"${NZ_BIN}\" -s \"${NEZHA_SERVER}:${NEZHA_PORT}\" -p \"${NEZHA_KEY}\" ${NEZHA_TLS} --disable-auto-update --report-delay 4 --skip-conn --skip-procs >/dev/null 2>&1 &`;
  } else if (NEZHA_SERVER && NEZHA_KEY) {
    let port = '';
    if (!NEZHA_PORT) {
      port = NEZHA_SERVER.includes(':') ? NEZHA_SERVER.split(':').pop() : '';
    }
    const NZ_TLS = port ? (tlsPorts.includes(port) ? 'true' : 'false') : 'false';
    const configYaml = `client_secret: ${NEZHA_KEY}
debug: false
disable_auto_update: true
disable_command_execute: false
disable_force_update: true
disable_nat: false
disable_send_query: false
gpu: false
insecure_tls: true
ip_report_period: 1800
report_delay: 4
server: ${NEZHA_SERVER}
skip_connection_count: true
skip_procs_count: true
temperature: false
tls: ${NZ_TLS}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${UUID}`;

    fs.writeFileSync(NZ_CONFIG, configYaml, 'utf8');
    command = `nohup \"${NZ_BIN}\" -c \"${NZ_CONFIG}\" >/dev/null 2>&1 &`;
  } else {
    return;
  }

  try {
    exec(command, { shell: '/bin/bash' }, (err) => {
      if (err) console.error('npm running error:', err);
      else console.log('npm is running');
    });
  } catch (error) {
    console.error(`error: ${error}`);
  }
};

// ================= 自动访问保活 =================
// 若开启 AUTO_ACCESS，则向外部服务发送当前订阅地址进行保活
async function addAccessTask() {
  if (!AUTO_ACCESS) return;

  if (!DOMAIN) {
    return;
  }
  const fullURL = `https://${DOMAIN}/${SUB_PATH}`;
  try {
    const res = await axios.post("https://oooo.serv00.net/add-url", {
      url: fullURL
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Automatic Access Task added successfully');
  } catch (error) {
    // console.error('Error adding Task:', error.message);
  }
}

// ================= 清理临时文件 =================
// 启动后一段时间清理 nezha 临时文件和后台进程残留
const delFiles = () => {
  ['npm', NZ_BIN, NZ_CONFIG, CONFIG_DIR].forEach(file => {
    try { fs.unlink(file, () => {}); } catch (e) {}
    try { fs.rmdir(file); } catch (e) {}
  });
};

// ================= 启动服务 =================
httpServer.listen(PORT, () => {
  runnz();
  setTimeout(() => {
    delFiles();
  }, 180000);
  addAccessTask();
  console.log(`Server is running on port ${PORT}`);
});
