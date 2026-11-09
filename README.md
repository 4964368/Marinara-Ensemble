# Marinara-Ensemble

Marinara-Ensemble 是 [Marinara Engine](https://github.com/Pasta-Devs/Marinara-Engine) 的独立源码分支，用于和多个 AI 角色共同扮演。每个角色可以使用不同的模型，记住自己经历过的事，并在你离开后继续行动。你也是这个世界里的参与者。

本分支基于上游提交 [`fc0333c`](https://github.com/Pasta-Devs/Marinara-Engine/commit/fc0333c3fe978cda5e0b919bd6faec985901704e)，P0、M1 和 M2 修改于 2026 年 11 月完成。Pasta-Devs 不运营或背书此分支。下文所列的上游安装包不包含 Ensemble 的修改。

- [从源码启动](#从源码启动)
- [配置模型并进入演示](#配置模型并进入演示)
- [Ensemble 新增功能](#ensemble-新增功能)
- [上游平台安装指南](#上游平台安装指南)
- [继承的功能](#继承的功能)
- [上游界面截图](#上游界面截图)
- [文档](#文档)
- [社区与致谢](#社区与致谢)
- [许可证与品牌](#许可证与品牌)

## 从源码启动

准备 Node.js 24–26，并使用 [package.json](package.json) 中声明的 pnpm 版本。如果已经有本地仓库，从 `git switch` 那一步开始。

```sh
git clone https://github.com/4964368/Marinara-Ensemble.git
cd Marinara-Ensemble
git switch feat/ensemble-world
pnpm install
pnpm dev
```

打开终端显示的地址，通常是 [http://localhost:5173](http://localhost:5173)。第一次启动可能需要等待共享包和前端构建。终端运行期间保持窗口打开；按 <kbd>Ctrl</kbd>+<kbd>C</kbd> 停止。

要运行本地生产构建，先停止开发服务，再在同一目录执行：

```sh
pnpm build
pnpm start
```

生产构建默认访问 [http://127.0.0.1:7860](http://127.0.0.1:7860)。本地配置、访问密钥和运行数据不要提交到 Git。端口、数据目录和访问控制见[配置参考](docs/CONFIGURATION.md)。

## 配置模型并进入演示

1. 启动 LM Studio 的本地服务器。在 Marinara 的 **连接** 中添加 OpenAI 兼容连接。填写 LM Studio 显示的地址，通常为 `http://127.0.0.1:1234/v1`。只有模型服务要求认证时，才在应用中填写密钥。
2. 在角色编辑器中设置 **回复模型连接** 和 **回复模型 ID**，或使用聊天默认模型。角色世界需要在聊天设置中使用 **独立（Individual）** 群聊模式。
3. 保持应用运行，在另一个终端进入仓库目录，执行 `node scripts/create-ensemble-world-demo.mjs`。如果模型 ID 与演示默认值不同，按 [M2 演示说明](ENSEMBLE-WORLD.md)传入连接 ID 和两个模型 ID。
4. 打开 **M2 演示 · 翠庭的旧钥匙**，进入 **聊天设置** 的自治消息区域，展开 **角色世界**。在 **服务端角色互动** 中启动。想只和当前场景里的角色说话时，发送前选择 **当前在场角色**。

如果演示已因预算耗尽而暂停，先点 **停止**，再点 **启动** 开始新一轮。普通暂停则可以恢复。事件记录只显示玩家能够见证的内容。

## Ensemble 新增功能

| 阶段 | 功能 |
| --- | --- |
| P0：角色可见范围 | 为消息指定接收角色。角色的提示词、历史、摘要、检索和跨聊天回忆遵守保存的受众范围。来源权限无法核实时，受限材料不会进入共享上下文。 |
| M1：独立模型 | 每个角色可选用自己的连接和模型。独立群聊回复与服务端角色互动会按角色选用模型，可设置调用次数、Token 和间隔限制，并暂停或恢复。 |
| M2：角色世界 | 在独立群聊中设置场景和目标。角色可移动、观察、等待、交谈、私聊和转述，保留私有记忆、信念和方向性关系。服务端校验行动、保存结果，并显示玩家见证的事件。 |

M2 是开发里程碑。源码构建与 P0、M1、M2 回归测试已通过；M2 专项浏览器流程通过。通用桌面冒烟有两项因继承的能力包目录接口返回 HTTP 500 而失败。当前限制、演示配置和 M3 接口见 [M2 运行说明](ENSEMBLE-WORLD.md)。

多人联机是可选功能。私有共享会话需要两次明确授权，并要求每位参与者使用可信客户端。参见[联机设置与限制](docs/CONFIGURATION.md#optional-multiplayer)。

## 上游平台安装指南

以下指南描述继承自 Marinara Engine 的启动方式与服务。链接中的上游安装包和容器镜像不包含 Ensemble 提交。

| 平台 | 指南 |
| --- | --- |
| Docker / Podman | [容器安装](docs/installation/containers.md) |
| Windows | [Windows 安装](docs/installation/windows.md) |
| macOS / Linux | [macOS 和 Linux 安装](docs/installation/macos-linux.md) |
| Android APK | [下载上游 APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) · [安装指南](android/README.md) |
| Android 手动安装 | [Termux 安装指南](docs/installation/android-termux.md) |
| iOS / iPadOS | [PWA 安装指南](docs/installation/ios-pwa.md) |

本分支的上游版本为 [v2.5.2](https://github.com/Pasta-Devs/Marinara-Engine/releases/tag/v2.5.2)。[上游 Releases](https://github.com/Pasta-Devs/Marinara-Engine/releases)提供 Windows 安装包、Android 引导 APK 和版本化源码 ZIP；历史改动见 [CHANGELOG.md](CHANGELOG.md)。Android 引导应用通过 Termux 在同一台设备上启动本地服务器，再用 WebView 或浏览器打开。Android 阻止自动切换时，按 [APK 指南](android/README.md)完成手动步骤。上游安装的升级方式见[升级指南](docs/UPGRADING.md)。

本机回环地址默认可用；普通局域网或公网客户端通常需要登录。在 **设置 → 高级 → 访问** 中配置登录，或按提示使用服务器日志里的一次性设置码。忘记登录时，可在本机运行 `pnpm reset-login`。Tailscale、同主机容器网络、反向代理和隧道的信任边界见[远程访问指南](docs/REMOTE_ACCESS.md)。备份、批量导入、更新和自定义工具变更等操作还受管理员密钥保护，详见[访问控制](docs/CONFIGURATION.md#access-control)。

## 继承的功能

- **聊天与角色扮演：** 三种模式分别用于对话、沉浸式角色扮演和由 AI 主持的游戏。可以创建、导入角色，通过角色卡浏览器查找公开角色卡，管理聊天文件夹与分支，切换备选回复，或从 SillyTavern 导入。
- **画面与声音：** 支持角色表情和立绘、自定义场景背景、天气、视觉小说视图、聊天图集、短视频、语音和分镜。部分能力来自可下载智能体，例如 Expression Engine、World State、Illustrator 和 Storyboard。
- **外观与布局：** 支持明暗主题、字体、配色、聊天气泡和窗口布局；也可导入 CSS 主题和角色卡样式。见[外观设置](docs/appearance/appearance-settings.md)与[自定义 CSS 主题](docs/appearance/custom-css-themes.md)。
- **智能体与小游戏：** 从 [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 安装所需的写作、追踪、插画、音乐、记忆和关系智能体。也可和角色玩 UNO、国际象棋、扑克、台球或井字棋。Noodle、Slurp 和 Gacha Forge 等可选应用提供独立入口。见[可下载智能体](docs/agents/built-in-agents.md)与[自定义智能体](docs/agents/custom-agents.md)。
- **提示词和扩展：** 可以调整预设顺序、设置关键词世界书、查看活动上下文，并使用正则脚本和宏。个人扩展默认停用；审核只适用于指定 SHA-256 指纹的代码。完整页面访问不受同样的沙箱限制，只应为可信代码启用。见[个人扩展](docs/extending/personal-extensions.md)。
- **模型和媒体服务：** 支持 OpenAI、Anthropic、Gemini、OpenRouter 等服务，以及 LM Studio、Ollama、KoboldCpp 等本地 OpenAI 兼容服务。还有图像、视频、语音与二元决策模型连接。模型可在输入框旁按聊天切换。已保存的 API 密钥以 AES-256 加密存储。见[服务商参考](docs/connections/providers-reference.md)与[决策模型](docs/connections/decision-models.md)。
- **导出与数据：** 聊天可导出为 JSONL、纯文本、Markdown 或 HTML，也可批量下载 JSONL ZIP。聊天数据保存在本机文件中；使用远程模型时，请求会发送给配置的服务商。

## 上游界面截图

以下图片来自 Marinara Engine，展示本分支继承的界面。

<p align="center">
  <img src="docs/screenshots/Desktop_Roleplay_View.png" width="90%" alt="桌面角色扮演：立绘、场景背景和天气" />
  <img src="docs/screenshots/Desktop_Tracker_Panel.png" width="90%" alt="角色扮演旁边的世界追踪面板" />
</p>

<p align="center">
  <img src="docs/screenshots/Desktop_Main_Menu.png" width="45%" alt="首页" />
  <img src="docs/screenshots/Desktop_Tutorial.png" width="45%" alt="入门教程" />
  <img src="docs/screenshots/Desktop_DM_Conversation.png" width="45%" alt="私聊" />
  <img src="docs/screenshots/Conversation_Selfie.png" width="45%" alt="带角色自拍的对话" />
  <img src="docs/screenshots/Desktop_Noodle_Timeline.png" width="45%" alt="Noodle 角色动态" />
  <img src="docs/screenshots/Desktop_Model_Picker.png" width="45%" alt="模型选择器" />
  <img src="docs/screenshots/Desktop_Chat_Settings_Window.png" width="45%" alt="聊天设置窗口" />
  <img src="docs/screenshots/Desktop_Appearance.png" width="45%" alt="外观设置" />
  <img src="docs/screenshots/Desktop_Custom_Theme.png" width="45%" alt="Umi 制作的 Persona 5 风格自定义主题" />
</p>

<p align="center">
  <img src="docs/screenshots/Browser_Game_Screen.png" width="90%" alt="游戏场景与 HUD" />
  <img src="docs/screenshots/Browser_Game_Dialogue.png" width="45%" alt="游戏对话" />
  <img src="docs/screenshots/Browser_Game_Party_Card.png" width="45%" alt="小队角色卡" />
</p>

<p align="center">
  <img src="docs/screenshots/Mobile_Group_Conversation.png" width="30%" alt="手机群聊" />
  <img src="docs/screenshots/Mobile_Roleplay_View.png" width="30%" alt="手机角色扮演" />
  <img src="docs/screenshots/Game_Mobile_Screen.png" width="30%" alt="手机游戏模式" />
</p>

## 文档

从应用首页的 **文档** 可以搜索上游指南。README 已汉化，以下链接中的上游文件继续保留其原有语言。

| 文档 | 内容 |
| --- | --- |
| [安装总览](docs/INSTALLATION.md) · [配置参考](docs/CONFIGURATION.md) · [常见问题](docs/FAQ.md) · [故障排查](docs/TROUBLESHOOTING.md) | 启动、环境变量和常见问题 |
| [对话模式](docs/conversation/getting-started.md) · [角色扮演](docs/roleplay/getting-started.md) · [游戏模式](docs/game/getting-started.md) · [规则集](docs/game/rulesets.md) | 三种模式和游戏规则 |
| [角色卡浏览器](docs/characters/bot-browser.md) · [表情和贴纸](docs/conversation/emoji-stickers-gifs.md) · [通话](docs/conversation/calls.md) | 角色导入与聊天工具 |
| [智能体概览](docs/agents/agents-overview.md) · [智能体目录](docs/agents/built-in-agents.md) · [Noodle](docs/agents/noodle.md) · [知识源](docs/agents/knowledge-sources.md) | 智能体、社交动态和检索 |
| [生成参数](docs/prompts/generation-parameters.md) · [预设](docs/prompts/presets.md) · [宏](docs/prompts/macros.md) · [正则脚本](docs/extending/regex-scripts.md) · [自定义工具](docs/extending/custom-tools.md) | 提示词和扩展 |
| [图像](docs/media/image-providers.md) · [ComfyUI](docs/media/comfyui.md) · [风格配置](docs/media/style-profiles.md) · [语音](docs/media/tts-setup.md) · [场景视频](docs/media/scene-video.md) · [分镜](docs/game/storyboard.md) · [LTX 2.3](docs/game/ltx-2-3-storyboards.md) | 媒体连接和工作流 |
| [远程访问](docs/REMOTE_ACCESS.md) · [Professor Mari](docs/home/professor-mari.md) · [Android](android/README.md) | 安全访问、内置助手和移动端 |
| [M2 运行与接口](ENSEMBLE-WORLD.md) · [本地化](docs/development/localization.md) · [前端](docs/development/frontend.md) · [架构](docs/development/architecture-map.md) · [贡献指南](CONTRIBUTING.md) · [维护者说明](AGENTS.md) | 开发和维护 |

## 社区与致谢

感谢 [Pasta-Devs 和 Marinara Engine 的贡献者](https://github.com/Pasta-Devs/Marinara-Engine/graphs/contributors)提供项目基础。Ensemble 的 P0、M1 和 M2 改动可在 Git 提交历史中追溯。分支相关问题可在 [Marinara-Ensemble Issues](https://github.com/4964368/Marinara-Ensemble/issues)记录；上游社区入口为 [Discord](https://discord.com/invite/KdAkTg94ME) 和 [Ko-fi](https://ko-fi.com/marinara_spaghetti)。

<p align="left">
  <a href="https://github.com/Pasta-Devs/Marinara-Engine/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=Pasta-Devs/Marinara-Engine" alt="Marinara Engine 上游贡献者" />
  </a>
</p>

贡献者图片由 [contrib.rocks](https://contrib.rocks) 生成。

## 许可证与品牌

Marinara-Ensemble 及其修改的 Marinara Engine 源码使用 [GNU AGPLv3](LICENSE)。上游许可证和版权声明保留。[第三方声明](THIRD_PARTY_NOTICES.md)列出了组件许可、素材条款和未核实事项。

部分服务商图标来自 LobeHub 的 [Lobe Icons](https://github.com/lobehub/lobe-icons)，使用 [MIT 许可证](packages/client/src/assets/provider-icons/LICENSE)。其他标识的来源和分类见[图标声明](packages/client/src/assets/provider-icons/README.md)。名称和标志仍属于各自权利人。

源码许可不授予将第三方产品或托管服务描述为 Pasta-Devs 官方、认证或背书的权利。对上游项目的引用应准确；经营托管服务时应标明独立运营者。见[上游商标与品牌政策](TRADEMARKS.md)。

olud.ai 是独立第三方服务，未获 Pasta-Devs 背书。

[![olud.ai](https://olud.ai/badge.php?tool=pasta-devs-marinara-engine)](https://olud.ai/project/pasta-devs-marinara-engine.html)
