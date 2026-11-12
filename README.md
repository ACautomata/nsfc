# NSFC Agent Skills（DSH 插件）

把 [njzjz/nsfc-agent-skills](https://github.com/njzjz/nsfc-agent-skills) 的四个 NSFC 申请书辅助技能，转换成一个 DeepSeek Harness（DSH）插件。插件作为一个 skill provider 注册到宿主的 `ctx.skills` 注册表，会话里用 `skill` 工具按需加载。

## 技能

技能 | 用途
---|---
nsfc-write | 选题、摘要、立项依据、研究内容、方案、创新与研究基础的写作指南
nsfc-figure | 生成可编辑的 Draw.io 概念图、技术路线图和研究基础图
nsfc-literature | 用 OpenAlex 检索文献，用 wenxian 生成引用
nsfc-policy | 2026 年度限项、AI 使用、申请代码和项目类型等政策速查

## 安装

方式一：插件市场（推荐，可看到版本与更新）

1. 在 DSH 的插件市场（Discover 页）添加索引源，URL 填：
   `https://raw.githubusercontent.com/ACautomata/nsfc/main/index.json`
2. 在索引里找到 **NSFC 申请书技能**，安装。

方式二：直接填安装地址

1. DSH 的 **Plugins** > **Add plugin**，安装地址填：`github:ACautomata/nsfc`
2. 或让 DSH 会话执行：用 `plugin_manager` 工具，`action: install_bundle`，`target` 填 `github:ACautomata/nsfc`。

两种方式都从 GitHub 拉取本仓库。市场索引按 `index.json` 固定 commit，装到的是发布版本；直接填地址装的是 `main` 最新提交。安装后，**新开的会话**即可看到这四个技能；已存在的会话保持启动时的技能清单。

### 发布新版本

1. 改 `package.json` 的 `version`，提交并推送。
2. 在 `index.json` 的 `versions` 数组头部追加新条目：新版本号、新 commit SHA（`git rev-parse main` 的完整 40 位值）、发布时间的 Unix 秒。
3. 用户端在插件市场看到更新提示。

## 使用

- 会话中说需求即可，模型会按各技能的触发条件自动调用 `skill` 工具加载对应指南。
- 也可以显式点名：例如“用 nsfc-literature 检索……”、“按 nsfc-figure 画一张技术路线图”。
- `nsfc-literature` 与 `nsfc-figure` 的辅助脚本需要 Python 3；脚本在技能目录的 `scripts/` 下。
- 技能目录里的 `references/`、`assets/`、`examples/` 按需读取。

## 目录结构

```
package.json        DSH bundle 清单
cordis.patch.yml    插入 Loader 行 nsfc-agent-skills
index.js            Host 插件：注册 ctx.skills provider
icon.svg            插件图标（市场索引引用同一文件）
index.json          DSH 插件市场索引（format 1），版本固定到 commit
locale/             插件标题与描述（en、zh）
skills/             四个技能目录，内容原样来自上游仓库
```

## 限制与免责

- 本插件只提供写作辅助和工作流，不保证申请成功。
- 政策、模板、字数、限项和资格条件，以申报年度的官方指南和系统提示为准。
- 自动生成或整理的内容、引用、图表和数据，必须人工核实后才能使用。
- 技能正文（`skills/` 目录）来自上游仓库；上游仓库未附 LICENSE 文件。本仓库的插件代码按 Apache-2.0（见 [LICENSE](LICENSE)）发布。

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
