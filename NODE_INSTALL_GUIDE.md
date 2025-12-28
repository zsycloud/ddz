# Node.js 安装指南

## 检查当前状态
运行以下命令检查 Node.js 是否已正确安装：
```
node --version
npm --version
```

如果命令无法识别，请按照以下步骤操作：

## 步骤1：完全卸载现有的 Node.js
1. 打开"控制面板" → "程序和功能"
2. 查找并卸载任何与 Node.js 相关的条目
3. 删除可能残留的目录（如 C:\Program Files\nodejs 或 C:\Users\用户名\AppData\Roaming\npm）

## 步骤2：重新下载并安装 Node.js
1. 访问 https://nodejs.org/
2. 下载 LTS 版本（推荐）
3. 以管理员身份运行安装程序
4. **重要**：在安装过程中确保勾选以下选项：
   - "Add to PATH"
   - "Install npm package manager"
   - "Add to Explorer context menu"（可选）

## 步骤3：验证安装
安装完成后，打开**新的**命令提示符窗口（重要），运行：
```
node --version
npm --version
```

## 步骤4：安装项目依赖
在项目目录中运行：
```
cd d:\Develop\Jeff_test\ddz
npm install
```

## 步骤5：启动项目
```
npx expo start
```

## 常见问题解决
如果仍然无法识别命令：
1. 重启计算机
2. 检查环境变量：
   - 按 Win+R，输入 sysdm.cpl
   - 点击"高级" → "环境变量"
   - 确认 Node.js 安装路径已添加到 PATH 变量中
   - 通常路径为 C:\Program Files\nodejs

## 验证项目依赖
安装完成后，可以运行以下命令验证：
```
npm list
```