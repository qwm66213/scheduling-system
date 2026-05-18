REGISTRY=registry.cn-hangzhou.aliyuncs.com
DOCKER_USERNAME=your-username
IMAGE_NAME=930-system
VERSION=latest

.PHONY: login build push

login:
	docker login --username=$(DOCKER_USERNAME) $(REGISTRY)

build:
	docker build -t $(REGISTRY)/$(DOCKER_USERNAME)/$(IMAGE_NAME):$(VERSION) .

push: build
	docker push $(REGISTRY)/$(DOCKER_USERNAME)/$(IMAGE_NAME):$(VERSION)