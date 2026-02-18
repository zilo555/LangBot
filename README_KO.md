<p align="center">
<a href="https://langbot.app">
<img width="130" src="https://docs.langbot.app/langbot-logo.png" alt="LangBot"/>
</a>

<div align="center">

<a href="https://www.producthunt.com/products/langbot?utm_source=badge-follow&utm_medium=badge&utm_source=badge-langbot" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/follow.svg?product_id=1077185&theme=light" alt="LangBot - Production&#0045;grade&#0032;IM&#0032;bot&#0032;made&#0032;easy&#0046; | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>

<h3>AI 에이전트 IM 봇 구축을 위한 프로덕션 등급 플랫폼.</h3>
<h4>Slack, Discord, Telegram, WeChat 등에 AI 봇을 빠르게 구축, 디버그 및 배포.</h4>

[English](README.md) / [简体中文](README_CN.md) / [繁體中文](README_TW.md) / [日本語](README_JP.md) / [Español](README_ES.md) / [Français](README_FR.md) / 한국어 / [Русский](README_RU.md) / [Tiếng Việt](README_VI.md)

[![Discord](https://img.shields.io/discord/1335141740050649118?logo=discord&labelColor=%20%235462eb&logoColor=%20%23f5f5f5&color=%20%235462eb)](https://discord.gg/wdNEHETs87)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/langbot-app/LangBot)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/langbot-app/LangBot)](https://github.com/langbot-app/LangBot/releases/latest)
<img src="https://img.shields.io/badge/python-3.10 ~ 3.13 -blue.svg" alt="python">
[![GitHub stars](https://img.shields.io/github/stars/langbot-app/LangBot?style=social)](https://github.com/langbot-app/LangBot/stargazers)

<a href="https://langbot.app">홈</a> ｜
<a href="https://docs.langbot.app/en/insight/features.html">기능</a> ｜
<a href="https://docs.langbot.app/en/insight/guide.html">문서</a> ｜
<a href="https://docs.langbot.app/en/tags/readme.html">API</a> ｜
<a href="https://space.langbot.app">플러그인 마켓</a> ｜
<a href="https://langbot.featurebase.app/roadmap">로드맵</a>

</div>

</p>

---

## 🚀 LangBot이란?

LangBot은 AI 기반 인스턴트 메시징 봇을 구축하기 위한 **오픈소스 프로덕션 등급 플랫폼**입니다. 대규모 언어 모델(LLM)을 모든 채팅 플랫폼에 연결하여 대화, 작업 실행, 기존 워크플로우와의 통합이 가능한 지능형 에이전트를 만들 수 있습니다.

### 핵심 기능

- **💬 AI 대화 및 에이전트** — 멀티턴 대화, 도구 호출, 멀티모달 지원, 스트리밍 출력. 내장 RAG(지식 베이스)와 [Dify](https://dify.ai), [Coze](https://coze.com), [n8n](https://n8n.io), [Langflow](https://langflow.org) 심층 통합.
- **🤖 유니버설 IM 플랫폼 지원** — 단일 코드베이스로 Discord, Telegram, Slack, LINE, QQ, WeChat, WeCom, Lark, DingTalk, KOOK 지원.
- **🛠️ 프로덕션 레디** — 접근 제어, 속도 제한, 민감어 필터링, 종합 모니터링 및 예외 처리. 기업 환경에서 검증됨.
- **🧩 플러그인 생태계** — 수백 개의 플러그인, 이벤트 기반 아키텍처, 컴포넌트 확장, [MCP 프로토콜](https://modelcontextprotocol.io/) 지원.
- **😻 웹 관리 패널** — 직관적인 브라우저 인터페이스로 봇을 구성, 관리 및 모니터링. YAML 편집 불필요.
- **📊 멀티 파이프라인 아키텍처** — 다양한 시나리오에 맞는 다양한 봇 구성, 종합 모니터링 및 예외 처리.

[→ 모든 기능 자세히 보기](https://docs.langbot.app/en/insight/features.html)

---

## 📦 빠른 시작

### 원라인 실행

```bash
uvx langbot
```

> [uv](https://docs.astral.sh/uv/getting-started/installation/) 설치 필요. http://localhost:5300 방문 — 완료.

### Docker Compose

```bash
git clone https://github.com/langbot-app/LangBot
cd LangBot/docker
docker compose up -d
```

### 원클릭 클라우드 배포

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/en-US/templates/ZKTBDH)
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.app/template/yRrAyL?referralCode=vogKPF)

**더 많은 옵션:** [Docker](https://docs.langbot.app/en/deploy/langbot/docker.html) · [수동 배포](https://docs.langbot.app/en/deploy/langbot/manual.html) · [BTPanel](https://docs.langbot.app/en/deploy/langbot/one-click/bt.html) · [Kubernetes](./docker/README_K8S.md)

---

## ✨ 지원 플랫폼

| 플랫폼 | 상태 | 비고 |
|--------|------|------|
| Discord | ✅ |  |
| Telegram | ✅ |  |
| Slack | ✅ |  |
| LINE | ✅ |  |
| QQ | ✅ | 개인 및 공식 API |
| WeCom | ✅ | 기업 WeChat, 외부 CS, AI Bot |
| WeChat | ✅ | 개인 및 공식 계정 |
| Lark | ✅ |  |
| DingTalk | ✅ |  |
| KOOK | ✅ |  |
| Satori | ✅ |  |

---

## 🤖 지원 LLM 및 통합

| 제공자 | 유형 | 상태 |
|--------|------|------|
| [OpenAI](https://platform.openai.com/) | LLM | ✅ |
| [Anthropic](https://www.anthropic.com/) | LLM | ✅ |
| [DeepSeek](https://www.deepseek.com/) | LLM | ✅ |
| [Google Gemini](https://aistudio.google.com/prompts/new_chat) | LLM | ✅ |
| [xAI](https://x.ai/) | LLM | ✅ |
| [Moonshot](https://www.moonshot.cn/) | LLM | ✅ |
| [Zhipu AI](https://open.bigmodel.cn/) | LLM | ✅ |
| [Ollama](https://ollama.com/) | 로컬 LLM | ✅ |
| [LM Studio](https://lmstudio.ai/) | 로컬 LLM | ✅ |
| [Dify](https://dify.ai) | LLMOps | ✅ |
| [MCP](https://modelcontextprotocol.io/) | 프로토콜 | ✅ |
| [SiliconFlow](https://siliconflow.cn/) | 게이트웨이 | ✅ |
| [Aliyun Bailian](https://bailian.console.aliyun.com/) | 게이트웨이 | ✅ |
| [Volc Engine Ark](https://console.volcengine.com/ark/region:ark+cn-beijing/model?vendor=Bytedance&view=LIST_VIEW) | 게이트웨이 | ✅ |
| [ModelScope](https://modelscope.cn/docs/model-service/API-Inference/intro) | 게이트웨이 | ✅ |
| [GiteeAI](https://ai.gitee.com/) | 게이트웨이 | ✅ |
| [CompShare](https://www.compshare.cn/?ytag=GPU_YY-gh_langbot) | GPU 플랫폼 | ✅ |
| [PPIO](https://ppinfra.com/user/register?invited_by=QJKFYD&utm_source=github_langbot) | GPU 플랫폼 | ✅ |
| [ShengSuanYun](https://www.shengsuanyun.com/?from=CH_KYIPP758) | GPU 플랫폼 | ✅ |
| [接口 AI](https://jiekou.ai/) | 게이트웨이 | ✅ |
| [302.AI](https://share.302.ai/SuTG99) | 게이트웨이 | ✅ |

[→ 모든 통합 보기](https://docs.langbot.app/en/insight/features.html)

---

## 🌟 왜 LangBot인가?

| 사용 사례 | LangBot 활용 방법 |
|-----------|-------------------|
| **고객 지원** | 지식 베이스를 활용하여 질문에 답변하는 AI 에이전트를 Slack/Discord/Telegram에 배포 |
| **내부 도구** | n8n/Dify 워크플로우를 WeCom/DingTalk에 연결하여 비즈니스 프로세스 자동화 |
| **커뮤니티 관리** | AI 기반 콘텐츠 필터링 및 상호작용으로 QQ/Discord 그룹 관리 |
| **멀티 플랫폼** | 하나의 봇으로 모든 플랫폼 지원. 단일 대시보드에서 관리 |

---

## 🎮 라이브 데모

**지금 체험:** https://demo.langbot.dev/
- 이메일: `demo@langbot.app`
- 비밀번호: `langbot123456`

*참고: 공개 데모 환경입니다. 민감한 정보를 입력하지 마세요.*

---

## 🤝 커뮤니티

[![Discord](https://img.shields.io/discord/1335141740050649118?logo=discord&label=Discord)](https://discord.gg/wdNEHETs87)

- 💬 [Discord 커뮤니티](https://discord.gg/wdNEHETs87)

---

## ⭐ Star 추이

[![Star History Chart](https://api.star-history.com/svg?repos=langbot-app/LangBot&type=Date)](https://star-history.com/#langbot-app/LangBot&Date)

---

## 😘 기여자

LangBot을 더 나은 프로젝트로 만들어 주신 모든 [기여자](https://github.com/langbot-app/LangBot/graphs/contributors)분들께 감사드립니다:

<a href="https://github.com/langbot-app/LangBot/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=langbot-app/LangBot" />
</a>
