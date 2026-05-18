# 930管理系统 - Docker 部署指南

## 一、前置准备

### 1. 阿里云容器镜像服务配置

1. 登录 [阿里云容器镜像服务](https://cr.console.aliyun.com/)
2. 开通个人版实例（免费）
3. 创建命名空间（如：`scheduling`）
4. 创建镜像仓库（仓库名称：`930-system`）
5. 记录你的仓库地址，格式：`registry.cn-<区域>.aliyuncs.com/<命名空间>/930-system`

### 2. 本地环境要求

- Docker Desktop（Windows/Mac）或 Docker Engine（Linux）

## 二、本地构建与推送

### 方式一：使用脚本（推荐）

**Windows 用户：**
```bash
# 1. 编辑 deploy.bat，修改以下变量
set REGISTRY=registry.cn-hangzhou.aliyuncs.com
set DOCKER_USERNAME=你的阿里云账号

# 2. 登录阿里云镜像仓库
deploy.bat login

# 3. 构建并推送镜像
deploy.bat push
```

**Linux/Mac 用户：**
```bash
# 1. 编辑 Makefile，修改以下变量
REGISTRY=registry.cn-hangzhou.aliyuncs.com
DOCKER_USERNAME=你的阿里云账号

# 2. 登录阿里云镜像仓库
make login

# 3. 构建并推送镜像
make push
```

### 方式二：手动执行

```bash
# 1. 登录阿里云镜像仓库
docker login --username=你的阿里云账号 registry.cn-hangzhou.aliyuncs.com

# 2. 构建镜像
docker build -t registry.cn-hangzhou.aliyuncs.com/你的命名空间/930-system:latest .

# 3. 推送镜像
docker push registry.cn-hangzhou.aliyuncs.com/你的命名空间/930-system:latest
```

## 三、服务器部署

### 1. 服务器环境准备

```bash
# 安装 Docker（以 CentOS 为例）
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 登录阿里云镜像仓库
sudo docker login --username=你的阿里云账号 registry.cn-hangzhou.aliyuncs.com
```

### 2. 创建部署目录

```bash
mkdir -p /opt/930-system
cd /opt/930-system
```

### 3. 创建 docker-compose.yml

参考项目根目录的 `docker-compose.yml` 文件。

### 4. 启动服务

```bash
# 拉取最新镜像
docker compose pull

# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f
```

## 四、常用运维命令

```bash
# 查看日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新镜像并重启
docker compose pull && docker compose up -d

# 进入容器
docker exec -it 930-system sh
```

## 五、注意事项

1. **镜像仓库地址**：根据你选择的阿里云区域修改 `REGISTRY` 地址
2. **端口冲突**：如 3001 端口被占用，请修改 docker-compose.yml 中的端口映射
3. **安全建议**：生产环境建议配置 HTTPS 和防火墙规则