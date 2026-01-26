<p align="center">
  <img src="icon.png" width="128" height="128" alt="Windsurf Logo">
</p>

<h1 align="center">Windsurf 无感换号</h1>

<p align="center">
  <strong>Windsurf 账号无感切换工具</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/VSCode-1.80+-purple.svg" alt="VSCode">
  <a href="https://qm.qq.com/q/UsRJVIm10"><img src="https://img.shields.io/badge/QQ群-Code开源技术交流群-blue.svg" alt="QQ群"></a>
</p>

---

## ✨ 功能特性

- 🔐 **添加账号** - 输入邮箱和密码，通过 Firebase Auth 自动获取 API Key
- 🔄 **无感切换** - 一键切换到其他已保存的账号，自动注入会话
- 🗑️ **删除账号** - 从列表中删除不需要的账号
- 📋 **复制 API Key** - 一键复制账号的 API Key
- 🔍 **搜索账号** - 快速搜索已保存的账号
- ⚡ **快捷键** - 快速切换下一个账号
- 📱 **手动添加** - 支持直接输入 API Key 添加账号

---

## ⌨️ 快捷键

| 功能 | Mac | Windows |
|------|-----|---------|
| 切换下一个账号 | `⌘ + ⌥ + K` | `Ctrl + Alt + K` |

---

## 📦 安装

### 方式一：直接安装 VSIX（推荐）

1. 下载 `windsurf-account-switcher-1.0.0.vsix`
2. 在 Windsurf 中：**扩展** → **从 VSIX 安装**
3. 选择下载的 `.vsix` 文件

### 方式二：从源码构建

```bash
git clone https://github.com/crispvibe/WindsurfSwitch.git
cd WindsurfSwitch
npm install
npm run compile
npm run package
```

---

## 🚀 使用方法

1. 点击左侧 Activity Bar 的 **Windsurf 换号** 图标
2. 点击「**添加账号**」按钮
3. 输入 Windsurf 账号的邮箱和密码
4. 等待自动获取 API Key 并保存
5. 点击账号列表中的账号进行切换

### 添加账号方式

| 方式 | 说明 |
|------|------|
| **登录模式** | 输入邮箱和密码，自动通过 Firebase Auth 获取 Token 和 API Key |
| **手动模式** | 直接输入邮箱和 API Key（适合已有 API Key 的情况） |

---

## 🪄 注意事项

> ⚠️ **需要开启魔法（代理/VPN）才能连接 Google Firebase 获取 API Key**

- 首次切换账号会自动应用补丁并重启 Windsurf
- Windsurf 更新后可能需要重新应用补丁
- 建议定期备份账号数据

---

## 📁 补丁文件位置

| 系统 | 路径 |
|------|------|
| **Windows** | `%LOCALAPPDATA%\Programs\Windsurf\resources\app\extensions\windsurf\dist\extension.js` |
| **macOS** | `/Applications/Windsurf.app/Contents/Resources/app/extensions/windsurf/dist/extension.js` |
| **Linux** | `/opt/Windsurf/resources/app/extensions/windsurf/dist/extension.js` |

---

## 🛠️ 技术栈

- **TypeScript** - 类型安全的 JavaScript
- **VSCode Extension API** - 扩展开发框架
- **Firebase Auth REST API** - 用户认证（直连 Google，无中转）
- **sql.js** - 本地数据库操作

---

## 💬 交流群

<a href="https://qm.qq.com/q/UsRJVIm10">
  <img src="https://img.shields.io/badge/QQ群-Code开源技术交流群-blue.svg?style=for-the-badge" alt="QQ群">
</a>

点击上方徽章或 [点击这里](https://qm.qq.com/q/UsRJVIm10) 加入群聊

---

## ⚠️ 免责声明

本项目仅供学习和研究使用，不得用于商业用途。

- **风险自负**: 使用本工具所产生的一切后果由使用者自行承担
- **无担保**: 本项目按"原样"提供，不提供任何明示或暗示的担保
- **无关联**: 本项目与 Codeium / Windsurf 官方无任何关联
- **合规风险**: 使用本工具可能违反 Windsurf 的服务条款，请自行评估风险
- **维护声明**: 本项目可能随时停止维护，恕不另行通知

**使用本工具即表示您已阅读并同意上述条款。**

---

## 📄 许可证

[MIT License](LICENSE)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/crispvibe">crispvibe</a>
</p>
