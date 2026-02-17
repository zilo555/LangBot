<p align="center">
<a href="https://langbot.app">
<img width="130" src="https://docs.langbot.app/langbot-logo.png" alt="LangBot"/>
</a>

<div align="center">

<a href="https://www.producthunt.com/products/langbot?utm_source=badge-follow&utm_medium=badge&utm_source=badge-langbot" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/follow.svg?product_id=1077185&theme=light" alt="LangBot - Production&#0045;grade&#0032;IM&#0032;bot&#0032;made&#0032;easy&#0046; | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>

<h3>AIエージェント搭載IMボットを構築するための本番グレードプラットフォーム。</h3>
<h4>Slack、Discord、Telegram、WeChat などに AI ボットを素早く構築、デバッグ、デプロイ。</h4>

[English](README.md) / [简体中文](README_CN.md) / [繁體中文](README_TW.md) / 日本語 / [Español](README_ES.md) / [Français](README_FR.md) / [한국어](README_KO.md) / [Русский](README_RU.md) / [Tiếng Việt](README_VI.md)

[![Discord](https://img.shields.io/discord/1335141740050649118?logo=discord&labelColor=%20%235462eb&logoColor=%20%23f5f5f5&color=%20%235462eb)](https://discord.gg/wdNEHETs87)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/langbot-app/LangBot)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/langbot-app/LangBot)](https://github.com/langbot-app/LangBot/releases/latest)
<img src="https://img.shields.io/badge/python-3.10 ~ 3.13 -blue.svg" alt="python">
[![GitHub stars](https://img.shields.io/github/stars/langbot-app/LangBot?style=social)](https://github.com/langbot-app/LangBot/stargazers)

<a href="https://langbot.app">ホーム</a> ｜
<a href="https://docs.langbot.app/ja/insight/features.html">機能</a> ｜
<a href="https://docs.langbot.app/ja/insight/guide.html">ドキュメント</a> ｜
<a href="https://docs.langbot.app/ja/tags/readme.html">API</a> ｜
<a href="https://space.langbot.app">プラグインマーケット</a> ｜
<a href="https://langbot.featurebase.app/roadmap">ロードマップ</a>

</div>

</p>

---

## 🚀 LangBot とは？

LangBot は、AI搭載のインスタントメッセージングボットを構築するための**オープンソースの本番グレードプラットフォーム**です。大規模言語モデル（LLM）をあらゆるチャットプラットフォームに接続し、会話、タスク実行、既存のワークフローとの統合が可能なインテリジェントエージェントを作成できます。

### 主な機能

- **💬 AI対話とエージェント** — マルチターン対話、ツール呼び出し、マルチモーダル対応、ストリーミング出力。RAG（ナレッジベース）を内蔵し、[Dify](https://dify.ai)、[Coze](https://coze.com)、[n8n](https://n8n.io)、[Langflow](https://langflow.org) と深く統合。
- **🤖 ユニバーサルIMプラットフォーム対応** — 単一のコードベースで Discord、Telegram、Slack、LINE、QQ、WeChat、WeCom、Lark、DingTalk、KOOK に対応。
- **🛠️ 本番環境対応** — アクセス制御、レート制限、センシティブワードフィルタリング、包括的な監視、例外処理を搭載。エンタープライズの信頼に応える品質。
- **🧩 プラグインエコシステム** — 数百のプラグイン、イベント駆動アーキテクチャ、コンポーネント拡張、[MCPプロトコル](https://modelcontextprotocol.io/)対応。
- **😻 Web管理パネル** — 直感的なブラウザインターフェースからボットの設定、管理、監視が可能。YAML編集は不要。
- **📊 マルチパイプラインアーキテクチャ** — 異なるシナリオに異なるボットを配置し、包括的な監視と例外処理を実現。

[→ すべての機能について詳しく見る](https://docs.langbot.app/ja/insight/features.html)

---

## 📦 クイックスタート

### ワンライン起動

```bash
uvx langbot
```

> [uv](https://docs.astral.sh/uv/getting-started/installation/) が必要です。http://localhost:5300 にアクセスして完了。

### Docker Compose

```bash
git clone https://github.com/langbot-app/LangBot
cd LangBot/docker
docker compose up -d
```

### ワンクリッククラウドデプロイ

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/en-US/templates/ZKTBDH)
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.app/template/yRrAyL?referralCode=vogKPF)

**その他:** [Docker](https://docs.langbot.app/en/deploy/langbot/docker.html) · [手動デプロイ](https://docs.langbot.app/en/deploy/langbot/manual.html) · [BTPanel](https://docs.langbot.app/en/deploy/langbot/one-click/bt.html) · [Kubernetes](./docker/README_K8S.md)

---

## ✨ 対応プラットフォーム

| プラットフォーム | ステータス | 備考 |
|----------|--------|-------|
| Discord | ✅ |  |
| Telegram | ✅ |  |
| Slack | ✅ |  |
| LINE | ✅ |  |
| QQ | ✅ | 個人 & 公式API |
| WeCom | ✅ | 企業WeChat、外部CS、AIボット |
| WeChat | ✅ | 個人 & 公式アカウント |
| Lark | ✅ |  |
| DingTalk | ✅ |  |
| KOOK | ✅ |  |

---

## 🤖 対応LLMと統合

| プロバイダー | タイプ | ステータス |
|----------|------|--------|
| [OpenAI](https://platform.openai.com/) | LLM | ✅ |
| [Anthropic](https://www.anthropic.com/) | LLM | ✅ |
| [DeepSeek](https://www.deepseek.com/) | LLM | ✅ |
| [Google Gemini](https://aistudio.google.com/prompts/new_chat) | LLM | ✅ |
| [xAI](https://x.ai/) | LLM | ✅ |
| [Moonshot](https://www.moonshot.cn/) | LLM | ✅ |
| [Zhipu AI](https://open.bigmodel.cn/) | LLM | ✅ |
| [Ollama](https://ollama.com/) | ローカルLLM | ✅ |
| [LM Studio](https://lmstudio.ai/) | ローカルLLM | ✅ |
| [Dify](https://dify.ai) | LLMOps | ✅ |
| [MCP](https://modelcontextprotocol.io/) | プロトコル | ✅ |
| [SiliconFlow](https://siliconflow.cn/) | ゲートウェイ | ✅ |
| [Aliyun Bailian](https://bailian.console.aliyun.com/) | ゲートウェイ | ✅ |
| [Volc Engine Ark](https://console.volcengine.com/ark/region:ark+cn-beijing/model?vendor=Bytedance&view=LIST_VIEW) | ゲートウェイ | ✅ |
| [ModelScope](https://modelscope.cn/docs/model-service/API-Inference/intro) | ゲートウェイ | ✅ |
| [GiteeAI](https://ai.gitee.com/) | ゲートウェイ | ✅ |
| [CompShare](https://www.compshare.cn/?ytag=GPU_YY-gh_langbot) | GPUプラットフォーム | ✅ |
| [PPIO](https://ppinfra.com/user/register?invited_by=QJKFYD&utm_source=github_langbot) | GPUプラットフォーム | ✅ |
| [ShengSuanYun](https://www.shengsuanyun.com/?from=CH_KYIPP758) | GPUプラットフォーム | ✅ |
| [接口 AI](https://jiekou.ai/) | ゲートウェイ | ✅ |
| [302.AI](https://share.302.ai/SuTG99) | ゲートウェイ | ✅ |

[→ すべての統合を表示](https://docs.langbot.app/en/insight/features.html)

---

## 🌟 なぜ LangBot？

| ユースケース | LangBot の活用方法 |
|----------|-------------------|
| **カスタマーサポート** | ナレッジベースを活用して質問に回答するAIエージェントをSlack/Discord/Telegramにデプロイ |
| **社内ツール** | n8n/Difyのワークフローを WeCom/DingTalk に接続し、業務プロセスを自動化 |
| **コミュニティ管理** | AI搭載のコンテンツフィルタリングとインタラクションでQQ/Discordグループをモデレーション |
| **マルチプラットフォーム展開** | 1つのボットで全プラットフォームに対応。単一のダッシュボードから管理 |

---

## 🎮 ライブデモ

**今すぐ試す:** https://demo.langbot.dev/
- メール: `demo@langbot.app`
- パスワード: `langbot123456`

*注意: 公開デモ環境です。機密情報を入力しないでください。*

---

## 🤝 コミュニティ

[![Discord](https://img.shields.io/discord/1335141740050649118?logo=discord&label=Discord)](https://discord.gg/wdNEHETs87)

- 💬 [Discord コミュニティ](https://discord.gg/wdNEHETs87)

---

## ⭐ Star 推移

[![Star History Chart](https://api.star-history.com/svg?repos=langbot-app/LangBot&type=Date)](https://star-history.com/#langbot-app/LangBot&Date)

---

## 😘 コントリビューター

LangBot をより良くするために貢献してくださったすべての[コントリビューター](https://github.com/langbot-app/LangBot/graphs/contributors)に感謝します:

<a href="https://github.com/langbot-app/LangBot/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=langbot-app/LangBot" />
</a>
