#!/bin/bash

# 服务器部署脚本
# 使用方法: ./deploy-server.sh

REGISTRY=registry.cn-hangzhou.aliyuncs.com
DOCKER_USERNAME=your-username
IMAGE_NAME=930-system
VERSION=latest

echo "=== 拉取最新镜像 ==="
docker pull $REGISTRY/$DOCKER_USERNAME/$IMAGE_NAME:$VERSION

echo "=== 重启服务 ==="
docker compose down
docker compose up -d

echo "=== 查看日志 ==="
docker compose logs -f