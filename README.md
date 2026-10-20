# 中英双向 AI 翻译助手

打开网址：
https://alicehbmanteng-eng.github.io/screen-translator/?v=7

## 当前使用方式
- 不需要申请 API Key，不需要配置 Cloudflare Worker。
- 前端使用一个公开的、免密钥视觉 AI REST 接口：VisionSter（AHM7）。
- 截图会直接发送到该第三方服务，由其视觉模型识别并翻译。
- 支持英文→中文、中文→英文、自动判断中英方向、阿拉伯文→中文。
- 如需安装到 iPhone 主屏幕，请用 Safari 打开网页，点“分享”→“添加到主屏幕”。

## 服务说明
第三方服务说明与接口文档：
https://ahm7xmakki.com/imgchat
据其公开文档，接口支持图片 OCR / 视觉问答，无需账号或 API Key，并支持 CORS。公共服务仍可能限流、临时不可用或调整政策。
本项目没有独立托管模型，也不能保证每次翻译达到 Google 或 ChatGPT 的准确率。

## 隐私
上传的图片、文字会发送至第三方服务并交由其模型处理。不要上传客户机密报价、身份证件、密码、验证码、个人敏感信息或其他需要保密的数据。

## 跨 App 限制
iPhone 网页应用无法自动读取其他 App 的整个屏幕。使用方式仍是先截图，再在网页工具上传。
