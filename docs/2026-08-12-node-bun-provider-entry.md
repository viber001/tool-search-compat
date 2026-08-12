# OpenCode Provider 初始化问题记录

日期：2026-08-12

## 现象

OpenCode 桌面版切换到 `headroom-openai-fork` 或新建会话时提示：

```text
Failed to initialize provider: headroom-openai-fork
```

命令行版使用同一 provider 配置可以正常工作。

## 根因：Node 与 Bun 的目录入口差异

provider 原来使用目录作为本地 npm 入口：

```text
file:///Users/galaxy/.config/opencode/tool-search-compat/openai-fork
```

命令行版由 Bun 运行。Bun 会根据目录中的 `package.json`，读取 `main`/`exports`，解析到 `dist/index.js`。

桌面版由 Electron 内置的 Node 运行。Node 的 ESM 动态导入不支持把本地目录直接当作 `file://` 模块入口，会报：

```text
ERR_UNSUPPORTED_DIR_IMPORT
Directory import '/Users/galaxy/.config/opencode/tool-search-compat/openai-fork' is not supported
Did you mean to import "/Users/galaxy/.config/opencode/tool-search-compat/openai-fork/dist/index.js"?
```

因此 OpenCode 将底层模块加载失败包装成了 `Failed to initialize provider`。

## 修复

将 `/Users/galaxy/.config/opencode/opencode.jsonnet` 中的 provider 入口改为明确的编译文件：

```json
"npm": "file:///Users/galaxy/.config/opencode/tool-search-compat/openai-fork/dist/index.js"
```

随后重新生成 `/Users/galaxy/.config/opencode/opencode.jsonc`。

不要把目录 URI 当作跨运行时兼容的 ESM 入口。对于 OpenCode 桌面版和命令行版都要使用明确的 `dist/index.js` 文件路径。

## 验证

- Node 动态导入 `dist/index.js` 成功。
- OpenCode 命令行普通请求返回 `OK`。
- 强制调用 `tool_search` 的命令行测试返回 `OK`。
- OpenCode 桌面版会话已验证通过：`oc://renderer/server/c2lkZWNhcg/session/ses_00c5bb3beffe7nRIiWtneAAdNS`

配置文件不会热加载。修改 provider 入口后需要完全退出并重新启动 OpenCode 桌面版；仅切换 provider 或新建会话不足以重新加载模块。
