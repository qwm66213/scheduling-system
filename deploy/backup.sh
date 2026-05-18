#!/bin/bash

# 数据备份脚本
# 使用方法: ./backup.sh

BACKUP_DIR=./backups
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "=== 备份数据库 ==="
docker run --rm \
  -v scheduling-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/scheduling-backup-$DATE.tar.gz -C /data .

echo "备份完成: $BACKUP_DIR/scheduling-backup-$DATE.tar.gz"
ls -lh $BACKUP_DIR/