<p align="center">
<a href="https://langbot.app">
<img width="130" src="https://docs.langbot.app/langbot-logo.png" alt="LangBot"/>
</a>

<div align="center">

<a href="https://www.producthunt.com/products/langbot?utm_source=badge-follow&utm_medium=badge&utm_source=badge-langbot" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/follow.svg?product_id=1077185&theme=light" alt="LangBot - Production&#0045;grade&#0032;IM&#0032;bot&#0032;made&#0032;easy&#0046; | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>

<h3>Plataforma de grado de producción para construir bots de mensajería instantánea con agentes de IA.</h3>
<h4>Construya, depure y despliegue bots de IA rápidamente en Slack, Discord, Telegram, WeChat y más.</h4>

[English](README.md) / [简体中文](README_CN.md) / [繁體中文](README_TW.md) / [日本語](README_JP.md) / Español / [Français](README_FR.md) / [한국어](README_KO.md) / [Русский](README_RU.md) / [Tiếng Việt](README_VI.md)

[![Discord](https://img.shields.io/discord/1335141740050649118?logo=discord&labelColor=%20%235462eb&logoColor=%20%23f5f5f5&color=%20%235462eb)](https://discord.gg/wdNEHETs87)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/langbot-app/LangBot)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/langbot-app/LangBot)](https://github.com/langbot-app/LangBot/releases/latest)
<img src="https://img.shields.io/badge/python-3.10 ~ 3.13 -blue.svg" alt="python">
[![GitHub stars](https://img.shields.io/github/stars/langbot-app/LangBot?style=social)](https://github.com/langbot-app/LangBot/stargazers)

<a href="https://langbot.app">Inicio</a> ｜
<a href="https://docs.langbot.app/en/insight/features.html">Características</a> ｜
<a href="https://docs.langbot.app/en/insight/guide.html">Documentación</a> ｜
<a href="https://docs.langbot.app/en/tags/readme.html">API</a> ｜
<a href="https://space.langbot.app">Mercado de Plugins</a> ｜
<a href="https://langbot.featurebase.app/roadmap">Hoja de Ruta</a>

</div>

</p>

---

## 🚀 ¿Qué es LangBot?

LangBot es una **plataforma de código abierto y grado de producción** para construir bots de mensajería instantánea impulsados por IA. Conecta modelos de lenguaje de gran escala (LLMs) con cualquier plataforma de chat, permitiéndole crear agentes inteligentes que pueden conversar, ejecutar tareas e integrarse con sus flujos de trabajo existentes.

### Capacidades Clave

- **💬 Conversaciones e Agentes IA** — Diálogos de múltiples turnos, llamadas a herramientas, soporte multimodal, salida en streaming. RAG (base de conocimientos) incorporado con integración profunda con [Dify](https://dify.ai), [Coze](https://coze.com), [n8n](https://n8n.io), [Langflow](https://langflow.org).
- **🤖 Soporte Universal de Plataformas de MI** — Un solo código base para Discord, Telegram, Slack, LINE, QQ, WeChat, WeCom, Lark, DingTalk, KOOK.
- **🛠️ Listo para Producción** — Control de acceso, limitación de velocidad, filtrado de palabras sensibles, monitoreo completo y manejo de excepciones. De confianza para empresas.
- **🧩 Ecosistema de Plugins** — Cientos de plugins, arquitectura basada en eventos, extensiones de componentes y soporte del [protocolo MCP](https://modelcontextprotocol.io/).
- **😻 Panel de Gestión Web** — Configure, gestione y monitoree sus bots a través de una interfaz de navegador intuitiva. Sin necesidad de editar YAML.
- **📊 Arquitectura Multi-Pipeline** — Diferentes bots para diferentes escenarios, con monitoreo completo y manejo de excepciones.

[→ Conocer más sobre todas las funcionalidades](https://docs.langbot.app/en/insight/features.html)

---

## 📦 Inicio Rápido

### Lanzamiento en una línea

```bash
uvx langbot
```

> Requiere [uv](https://docs.astral.sh/uv/getting-started/installation/). Visite http://localhost:5300 — listo.

### Docker Compose

```bash
git clone https://github.com/langbot-app/LangBot
cd LangBot/docker
docker compose up -d
```

### Despliegue en la Nube con un Clic

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/en-US/templates/ZKTBDH)
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.app/template/yRrAyL?referralCode=vogKPF)

**Más opciones:** [Docker](https://docs.langbot.app/en/deploy/langbot/docker.html) · [Manual](https://docs.langbot.app/en/deploy/langbot/manual.html) · [BTPanel](https://docs.langbot.app/en/deploy/langbot/one-click/bt.html) · [Kubernetes](./docker/README_K8S.md)

---

## ✨ Plataformas Soportadas

| Plataforma | Estado | Notas |
|----------|--------|-------|
| Discord | ✅ |  |
| Telegram | ✅ |  |
| Slack | ✅ |  |
| LINE | ✅ |  |
| QQ | ✅ | Personal y API Oficial |
| WeCom | ✅ | WeChat Empresarial, CS Externo, AI Bot |
| WeChat | ✅ | Personal y Cuenta Oficial |
| Lark | ✅ |  |
| DingTalk | ✅ |  |
| KOOK | ✅ |  |

---

## 🤖 LLMs e Integraciones Soportadas

| Proveedor | Tipo | Estado |
|----------|------|--------|
| [OpenAI](https://platform.openai.com/) | LLM | ✅ |
| [Anthropic](https://www.anthropic.com/) | LLM | ✅ |
| [DeepSeek](https://www.deepseek.com/) | LLM | ✅ |
| [Google Gemini](https://aistudio.google.com/prompts/new_chat) | LLM | ✅ |
| [xAI](https://x.ai/) | LLM | ✅ |
| [Moonshot](https://www.moonshot.cn/) | LLM | ✅ |
| [Zhipu AI](https://open.bigmodel.cn/) | LLM | ✅ |
| [Ollama](https://ollama.com/) | LLM Local | ✅ |
| [LM Studio](https://lmstudio.ai/) | LLM Local | ✅ |
| [Dify](https://dify.ai) | LLMOps | ✅ |
| [MCP](https://modelcontextprotocol.io/) | Protocolo | ✅ |
| [SiliconFlow](https://siliconflow.cn/) | Pasarela | ✅ |
| [Aliyun Bailian](https://bailian.console.aliyun.com/) | Pasarela | ✅ |
| [Volc Engine Ark](https://console.volcengine.com/ark/region:ark+cn-beijing/model?vendor=Bytedance&view=LIST_VIEW) | Pasarela | ✅ |
| [ModelScope](https://modelscope.cn/docs/model-service/API-Inference/intro) | Pasarela | ✅ |
| [GiteeAI](https://ai.gitee.com/) | Pasarela | ✅ |
| [CompShare](https://www.compshare.cn/?ytag=GPU_YY-gh_langbot) | Plataforma GPU | ✅ |
| [PPIO](https://ppinfra.com/user/register?invited_by=QJKFYD&utm_source=github_langbot) | Plataforma GPU | ✅ |
| [ShengSuanYun](https://www.shengsuanyun.com/?from=CH_KYIPP758) | Plataforma GPU | ✅ |
| [接口 AI](https://jiekou.ai/) | Pasarela | ✅ |
| [302.AI](https://share.302.ai/SuTG99) | Pasarela | ✅ |

[→ Ver todas las integraciones](https://docs.langbot.app/en/insight/features.html)

---

## 🌟 ¿Por qué LangBot?

| Caso de Uso | Cómo Ayuda LangBot |
|----------|-------------------|
| **Atención al cliente** | Despliegue agentes de IA en Slack/Discord/Telegram que respondan preguntas usando su base de conocimientos |
| **Herramientas internas** | Conecte flujos de trabajo de n8n/Dify a WeCom/DingTalk para procesos empresariales automatizados |
| **Gestión de comunidades** | Modere grupos de QQ/Discord con filtrado de contenido e interacción impulsados por IA |
| **Presencia multiplataforma** | Un solo bot, todas las plataformas. Gestione desde un único panel de control |

---

## 🎮 Demo en Vivo

**Pruébelo ahora:** https://demo.langbot.dev/
- Correo electrónico: `demo@langbot.app`
- Contraseña: `langbot123456`

*Nota: Entorno de demostración público. No ingrese información confidencial.*

---

## 🤝 Comunidad

[![Discord](https://img.shields.io/discord/1335141740050649118?logo=discord&label=Discord)](https://discord.gg/wdNEHETs87)

- 💬 [Comunidad de Discord](https://discord.gg/wdNEHETs87)

---

## ⭐ Historial de Stars

[![Star History Chart](https://api.star-history.com/svg?repos=langbot-app/LangBot&type=Date)](https://star-history.com/#langbot-app/LangBot&Date)

---

## 😘 Colaboradores

Gracias a todos los [colaboradores](https://github.com/langbot-app/LangBot/graphs/contributors) que han ayudado a mejorar LangBot:

<a href="https://github.com/langbot-app/LangBot/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=langbot-app/LangBot" />
</a>
