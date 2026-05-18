@echo off
setlocal

set REGISTRY=registry.cn-hangzhou.aliyuncs.com
set DOCKER_USERNAME=your-username
set IMAGE_NAME=930-system
set VERSION=latest

if "%1"=="" goto help
if "%1"=="login" goto login
if "%1"=="build" goto build
if "%1"=="push" goto push
goto help

:login
docker login --username=%DOCKER_USERNAME% %REGISTRY%
goto end

:build
docker build -t %REGISTRY%/%DOCKER_USERNAME%/%IMAGE_NAME%:%VERSION% .
goto end

:push
docker build -t %REGISTRY%/%DOCKER_USERNAME%/%IMAGE_NAME%:%VERSION% .
docker push %REGISTRY%/%DOCKER_USERNAME%/%IMAGE_NAME%:%VERSION%
goto end

:help
echo Usage: deploy.bat [command]
echo Commands:
echo   login  - Login to Aliyun container registry
echo   build  - Build docker image
echo   push   - Build and push docker image
goto end

:end
endlocal