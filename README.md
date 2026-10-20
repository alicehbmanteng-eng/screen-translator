# 中英双向 AI 翻译助手

GitHub Pages 网页入口：
https://alicehbmanteng-eng.github.io/screen-translator/

## 当前架构
- 前端：截图上传 + 中英双向文字翻译界面。
- 后端：Cloudflare Workers AI，默认使用 `@cf/google/gemma-4-26b-a4b-it` 视觉模型。
- 不需要单独申请 Gemini API Key。
- 后端部署说明：见 [CLOUDFLARE_SETUP.txt](./CLOUDFLARE_SETUP.txt)。
- Worker 源码：[cloudflare-worker.js](./cloudflare-worker.js)。

## 限制
- 需要先部署 Cloudflare Worker、添加 Workers AI 绑定 `AI`，并配置 `APP_ACCESS_TOKEN` Secret。
- 网页不能自动读取 iPhone 上其他 App 的屏幕；需要先截图，再上传。
- Workers AI 免费额度有限；准确率需要使用实际截图验证，不能保证与 Google Lens 或 ChatGPT 每次一致。
- 不要上传机密客户数据、密码或验证码。
