# 项目编译和测试指南

## 环境准备

在开始编译和测试项目之前，您需要安装以下工具：

### 1. 安装 Node.js
- 访问 https://nodejs.org/
- 下载并安装 LTS 版本（推荐）
- 安装完成后，重启命令行工具

### 2. 验证 Node.js 安装
打开命令提示符，运行以下命令验证安装：
```
node --version
npm --version
```

### 3. 安装 Expo CLI
在命令提示符中运行：
```
npm install -g @expo/cli
```

### 4. 安装项目依赖
在项目根目录（d:\Develop\Jeff_test\ddz）中运行：
```
npm install
```

## 项目编译和测试

### 1. 启动开发服务器
在项目根目录中运行：
```
npx expo start
```

### 2. 在设备上测试
- 使用手机扫描终端中显示的二维码
- 或者使用模拟器（需要安装 Android Studio 或 Xcode）

## 依赖检查

您的项目需要以下依赖：

### 运行时依赖：
- expo (~51.0.0)
- expo-status-bar (~1.12.1)
- react (18.2.0)
- react-native (0.74.0)
- react-native-gesture-handler (~2.16.0)

### 开发依赖：
- @babel/core (^7.20.0)
- @types/react (~18.2.45)
- typescript (^5.1.3)

## 常见问题解决

### 问题1：npm install 失败
- 检查网络连接
- 尝试使用淘宝镜像：
  ```
  npm config set registry https://registry.npmmirror.com
  ```

### 问题2：expo 命令无法识别
- 确保全局安装了 Expo CLI
- 检查 PATH 环境变量

### 问题3：无法连接到开发服务器
- 确保手机和电脑在同一网络
- 检查防火墙设置

## 项目结构说明

- App.js: 游戏主逻辑和界面
- app.json: 应用配置
- package.json: 项目依赖和脚本
- README.md: 项目说明
- GAME_INFO.md: 游戏功能说明
- .vscode/: VSCode 配置

## 开发建议

1. 使用 VSCode 打开项目根目录
2. 安装推荐的扩展（React Native Tools, Expo Tools）
3. 在 VSCode 终端中运行命令
4. 使用 Expo Go 应用在手机上测试

## 注意事项

- 本项目是单机游戏，无需服务器
- 所有功能均可离线使用
- 无广告、无内购、无网络请求
- 专为老人设计，界面简洁，字体大