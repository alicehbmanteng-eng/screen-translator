# 中英双向 AI 翻译助手

网页入口：
https://alicehbmanteng-eng.github.io/screen-translator/?v=5

## 当前状态
- 前端已提交：中英双向翻译、阿拉伯文翻中文、截图上传、原文/译文显示。
- AI 后端源码：cloudflare-worker.js
- 部署说明：CLOUDFLARE_SETUP.txt
- 浏览器不会自动读取 iPhone 其他 App 的画面，仍需截图后上传。
- AI 识图翻译功能需要将 Worker 部署到一个 Cloudflare 账户并添加 Workers AI 绑定。

## 无需配置的模型试用方式
Cloudflare 官方模型 Playground 无需账户认证，可用来直接测试 Gemma 4 视觉模型：
https://playground.ai.cloudflare.com/?model=%40cf%2Fgoogle%2Fgemma-4-26b-a4b-it
主页也有按钮可打开此体验页并复制中英翻译提示词。

## 费用与准确率
Cloudflare Workers AI Free 计划目前为每天 10,000 Neurons；达到限额后当天后续请求会失败。图像识别与翻译的实际消耗视图像和输出长度而变。
模型支持视觉输入，但不能保证每张截图都达到 Google Lens 或 ChatGPT 的水平。姓名、公司名、价格、币种、数量、日期和网址请核对。

## 安全
- 不要将模型供应商密钥写进公开的网页代码。
- Worker 要求私有的 APP_ACCESS_TOKEN，并应在 Cloudflare Secrets 中配置。
- 不要上传客户机密、密码、验证码、个人身份信息或内部报价。
