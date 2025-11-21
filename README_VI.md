<p align="center">
<a href="https://langbot.app">
<img src="https://docs.langbot.app/social_en.png" alt="LangBot"/>
</a>

<div align="center">

<a href="https://www.producthunt.com/products/langbot?utm_source=badge-follow&utm_medium=badge&utm_source=badge-langbot" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/follow.svg?product_id=1077185&theme=light" alt="LangBot - Production&#0045;grade&#0032;IM&#0032;bot&#0032;made&#0032;easy&#0046; | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>

[English](README_EN.md) / [简体中文](README.md) / [繁體中文](README_TW.md) / [日本語](README_JP.md) / [Español](README_ES.md) / [Français](README_FR.md) / [한국어](README_KO.md) / [Русский](README_RU.md) / Tiếng Việt

[![Discord](https://img.shields.io/discord/1335141740050649118?logo=discord&labelColor=%20%235462eb&logoColor=%20%23f5f5f5&color=%20%235462eb)](https://discord.gg/wdNEHETs87)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/langbot-app/LangBot)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/langbot-app/LangBot)](https://github.com/langbot-app/LangBot/releases/latest)
<img src="https://img.shields.io/badge/python-3.10 ~ 3.13 -blue.svg" alt="python">

<a href="https://langbot.app">Trang chủ</a> ｜
<a href="https://docs.langbot.app/en/insight/guide.html">Triển khai</a> ｜
<a href="https://docs.langbot.app/en/plugin/plugin-intro.html">Plugin</a> ｜
<a href="https://github.com/langbot-app/LangBot/issues/new?assignees=&labels=%E7%8B%AC%E7%AB%8B%E6%8F%92%E4%BB%B6&projects=&template=submit-plugin.yml&title=%5BPlugin%5D%3A+%E8%AF%B7%E6%B1%82%E7%99%BB%E8%AE%B0%E6%96%B0%E6%8F%92%E4%BB%B6">Gửi Plugin</a>

</div>

</p>

LangBot là một nền tảng phát triển robot nhắn tin tức thời gốc LLM mã nguồn mở, nhằm mục đích cung cấp trải nghiệm phát triển robot IM sẵn sàng sử dụng, với các chức năng ứng dụng LLM như Agent, RAG, MCP, thích ứng với các nền tảng nhắn tin tức thời toàn cầu và cung cấp giao diện API phong phú, hỗ trợ phát triển tùy chỉnh.

## 📦 Bắt đầu

#### Khởi động Nhanh

Sử dụng `uvx` để khởi động bằng một lệnh (cần cài đặt [uv](https://docs.astral.sh/uv/getting-started/installation/)):

```bash
uvx langbot
```

Truy cập http://localhost:5300 để bắt đầu sử dụng.

#### Triển khai Docker Compose

```bash
git clone https://github.com/langbot-app/LangBot
cd LangBot/docker
docker compose up -d
```

Truy cập http://localhost:5300 để bắt đầu sử dụng.

Tài liệu chi tiết [Triển khai Docker](https://docs.langbot.app/en/deploy/langbot/docker.html).

#### Triển khai Một cú nhấp chuột trên BTPanel

LangBot đã được liệt kê trên BTPanel. Nếu bạn đã cài đặt BTPanel, bạn có thể sử dụng [tài liệu](https://docs.langbot.app/en/deploy/langbot/one-click/bt.html) để sử dụng nó.

#### Triển khai Cloud Zeabur

Mẫu Zeabur được đóng góp bởi cộng đồng.

[![Deploy on Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/en-US/templates/ZKTBDH)

#### Triển khai Cloud Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.app/template/yRrAyL?referralCode=vogKPF)

#### Các Phương pháp Triển khai Khác

Sử dụng trực tiếp phiên bản phát hành để chạy, xem tài liệu [Triển khai Thủ công](https://docs.langbot.app/en/deploy/langbot/manual.html).

#### Triển khai Kubernetes

Tham khảo tài liệu [Triển khai Kubernetes](./docker/README_K8S.md).

## 😎 Cập nhật Mới nhất

Nhấp vào các nút Star và Watch ở góc trên bên phải của kho lưu trữ để nhận các bản cập nhật mới nhất.

![star gif](https://docs.langbot.app/star.gif)

## ✨ Tính năng

- 💬 Chat với LLM / Agent: Hỗ trợ nhiều LLM, thích ứng với chat nhóm và chat riêng tư; Hỗ trợ các cuộc trò chuyện nhiều vòng, gọi công cụ, khả năng đa phương thức và đầu ra streaming. Triển khai RAG (cơ sở kiến thức) tích hợp sẵn và tích hợp sâu với [Dify](https://dify.ai), [Coze](https://coze.com), [n8n](https://n8n.io) v.v. LLMOps platforms.
- 🤖 Hỗ trợ Đa nền tảng: Hiện hỗ trợ QQ, QQ Channel, WeCom, WeChat cá nhân, Lark, DingTalk, Discord, Telegram, v.v.
- 🛠️ Độ ổn định Cao, Tính năng Phong phú: Kiểm soát truy cập gốc, giới hạn tốc độ, lọc từ nhạy cảm, v.v.; Dễ sử dụng, hỗ trợ nhiều phương pháp triển khai. Hỗ trợ nhiều cấu hình pipeline, các bot khác nhau cho các kịch bản khác nhau.
- 🧩 Mở rộng Plugin, Cộng đồng Hoạt động: Hỗ trợ các cơ chế plugin hướng sự kiện, mở rộng thành phần, v.v.; Tích hợp giao thức [MCP](https://modelcontextprotocol.io/) của Anthropic; Hiện có hàng trăng plugin.
- 😻 Giao diện Web: Hỗ trợ quản lý các phiên bản LangBot thông qua trình duyệt. Không cần viết tệp cấu hình thủ công.

Để biết thêm thông số kỹ thuật chi tiết, vui lòng tham khảo [tài liệu](https://docs.langbot.app/en/insight/features.html).

Hoặc truy cập môi trường demo: https://demo.langbot.dev/
  - Thông tin đăng nhập: Email: `demo@langbot.app` Mật khẩu: `langbot123456`
  - Lưu ý: Chỉ dành cho demo WebUI, vui lòng không nhập bất kỳ thông tin nhạy cảm nào trong môi trường công cộng.

### Nền tảng Nhắn tin

| Nền tảng | Trạng thái | Ghi chú |
| --- | --- | --- |
| Discord | ✅ |  |
| Telegram | ✅ |  |
| Slack | ✅ |  |
| LINE | ✅ |  |
| QQ Cá nhân | ✅ |  |
| QQ API Chính thức | ✅ |  |
| WeCom | ✅ |  |
| WeComCS | ✅ |  |
| WeCom AI Bot | ✅ |  |
| WeChat Cá nhân | ✅ |  |
| Lark | ✅ |  |
| DingTalk | ✅ |  |

### LLMs

| LLM | Trạng thái | Ghi chú |
| --- | --- | --- |
| [OpenAI](https://platform.openai.com/) | ✅ | Có sẵn cho bất kỳ mô hình định dạng giao diện OpenAI nào |
| [DeepSeek](https://www.deepseek.com/) | ✅ |  |
| [Moonshot](https://www.moonshot.cn/) | ✅ |  |
| [Anthropic](https://www.anthropic.com/) | ✅ |  |
| [xAI](https://x.ai/) | ✅ |  |
| [Zhipu AI](https://open.bigmodel.cn/) | ✅ |  |
| [CompShare](https://www.compshare.cn/?ytag=GPU_YY-gh_langbot) | ✅ | Nền tảng tài nguyên LLM và GPU |
| [PPIO](https://ppinfra.com/user/register?invited_by=QJKFYD&utm_source=github_langbot) | ✅ | Nền tảng tài nguyên LLM và GPU |
| [接口 AI](https://jiekou.ai/) | ✅ | Nền tảng tổng hợp LLM |
| [ShengSuanYun](https://www.shengsuanyun.com/?from=CH_KYIPP758) | ✅ | Nền tảng tài nguyên LLM và GPU |
| [302.AI](https://share.302.ai/SuTG99) | ✅ | Cổng LLM (MaaS) |
| [Google Gemini](https://aistudio.google.com/prompts/new_chat) | ✅ | |
| [Dify](https://dify.ai) | ✅ | Nền tảng LLMOps |
| [Ollama](https://ollama.com/) | ✅ | Nền tảng chạy LLM cục bộ |
| [LMStudio](https://lmstudio.ai/) | ✅ | Nền tảng chạy LLM cục bộ |
| [GiteeAI](https://ai.gitee.com/) | ✅ | Cổng giao diện LLM (MaaS) |
| [SiliconFlow](https://siliconflow.cn/) | ✅ | Cổng LLM (MaaS) |
| [Aliyun Bailian](https://bailian.console.aliyun.com/) | ✅ | Cổng LLM (MaaS), nền tảng LLMOps |
| [Volc Engine Ark](https://console.volcengine.com/ark/region:ark+cn-beijing/model?vendor=Bytedance&view=LIST_VIEW) | ✅ | Cổng LLM (MaaS), nền tảng LLMOps |
| [ModelScope](https://modelscope.cn/docs/model-service/API-Inference/intro) | ✅ | Cổng LLM (MaaS) |
| [MCP](https://modelcontextprotocol.io/) | ✅ | Hỗ trợ truy cập công cụ qua giao thức MCP |

## 🤝 Đóng góp Cộng đồng

Cảm ơn các [người đóng góp mã](https://github.com/langbot-app/LangBot/graphs/contributors) sau đây và các thành viên khác trong cộng đồng vì những đóng góp của họ cho LangBot:

<a href="https://github.com/langbot-app/LangBot/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=langbot-app/LangBot" />
</a>
