# CI/CD 部署指南（腾讯云 VPS）

本文说明如何通过 **GitHub Actions** 在 push 到 `main` 且 CI 通过后，自动 SSH 部署到 Ubuntu 24.04 服务器。

## 流程概览

```mermaid
flowchart LR
  A[git push main] --> B[CI: lint/test/build]
  B -->|通过| C[Deploy workflow]
  C --> D[SSH 到 VPS]
  D --> E[deploy/deploy.sh]
  E --> F[git pull + build + restart]
```

- **CI**（`.github/workflows/ci.yml`）：PR 与 push 时跑 lint、测试、配置校验。
- **Deploy**（`.github/workflows/deploy.yml`）：CI 在 `main`/`master` 上成功后触发；也可在 Actions 页手动 **Run workflow**。

## 一、服务器一次性初始化

在腾讯云 Ubuntu 24.04 上，用普通用户（如 `ubuntu`）执行：

```bash
# 1. 生成 SSH 部署密钥（在服务器上，供 GitHub Actions 连接）
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""

# 2. 把公钥加入 authorized_keys
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys

# 3. 若仓库是 private，再生成拉代码用的 deploy key 加到 GitHub Deploy keys
ssh-keygen -t ed25519 -f ~/.ssh/git_deploy -N ""
cat ~/.ssh/git_deploy.pub   # 复制到 GitHub → Settings → Deploy keys

# 4. 克隆并初始化（把 REPO_URL 换成你的仓库）
git clone git@github.com:YOU/atoms-demo.git /opt/atoms-demo
cd /opt/atoms-demo
REPO_URL=git@github.com:YOU/atoms-demo.git bash deploy/bootstrap-server.sh
```

### 配置生产环境变量（仅服务器本地，勿提交）

```bash
nano /opt/atoms-demo/.env
nano /opt/atoms-demo/backend/.env
```

根目录 `.env` 示例：

```bash
JWT_SECRET=你的长随机串
ENV=production
NODE_ENV=production
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
BACKEND_URL=https://api.yourdomain.com
OPENAI_API_KEY=          # 可选
```

`backend/.env` 示例：

```bash
ENV=production
JWT_SECRET=与上面相同
DATABASE_URL=postgresql+asyncpg://atoms:强密码@localhost:5432/atoms_demo
CORS_ORIGINS=https://yourdomain.com
TEMPLATES_ROOT=../templates
CONFIG_ROOT=../config
```

首次手动部署验证：

```bash
cd /opt/atoms-demo
bash deploy/deploy.sh
sudo systemctl status atoms-backend atoms-frontend
```

Nginx + HTTPS：参考 `deploy/nginx/atoms-demo.conf.example`，再用 `certbot --nginx` 签发证书。

## 二、配置 GitHub Secrets

仓库 → **Settings → Secrets and variables → Actions → New repository secret**：

| Secret | 说明 | 示例 |
|--------|------|------|
| `DEPLOY_HOST` | 服务器公网 IP 或域名 | `123.45.67.89` |
| `DEPLOY_USER` | SSH 用户名 | `ubuntu` |
| `DEPLOY_SSH_KEY` | 私钥全文 | `~/.ssh/github_deploy` 的内容 |
| `DEPLOY_PATH` | 可选，代码目录 | `/opt/atoms-demo` |

建议创建 **Environment `production`**（Settings → Environments），把 Secrets 挂在该环境下，Deploy workflow 已引用 `environment: production`。

## 三、日常发布

```bash
git push origin main
```

1. CI 自动运行测试  
2. 成功后 Deploy workflow SSH 到服务器执行 `deploy/deploy.sh`  
3. 脚本会：`git pull` → `pnpm build` → `pip install -e .` → `systemctl restart`

也可在 GitHub **Actions → Deploy → Run workflow** 手动触发。

## 四、目录说明

| 文件 | 作用 |
|------|------|
| `deploy/deploy.sh` | 每次发布的增量脚本 |
| `deploy/bootstrap-server.sh` | 新机一次性安装依赖、systemd |
| `deploy/systemd/*.service` | systemd 单元模板 |
| `deploy/nginx/atoms-demo.conf.example` | Nginx 反代 + SSE 配置示例 |

## 五、常见问题

**Deploy 失败：Permission denied**  
检查 `DEPLOY_SSH_KEY` 是否与服务器 `authorized_keys` 匹配。

**Deploy 失败：git pull**  
私有仓库需在服务器配置 Deploy key 或 HTTPS token。

**systemctl restart 要密码**  
`bootstrap-server.sh` 会写入 `/etc/sudoers.d/atoms-deploy`；或手动配置 NOPASSWD。

**Cookie / 登录失败**  
确认 `ENV=production`、全站 HTTPS、`CORS_ORIGINS` 与前端域名一致、`JWT_SECRET` 前后端相同。

**SSE 卡住**  
确认 Nginx 已设置 `proxy_buffering off` 和足够长的 `proxy_read_timeout`。

## 六、安全建议

- 安全组只开放 22、80、443  
- 不要把 `.env` 提交到 Git  
- 定期 `pg_dump` 备份 PostgreSQL  
- 生产环境更换默认数据库密码
