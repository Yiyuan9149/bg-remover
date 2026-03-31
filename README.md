# bg-remover

一个最小可用的 Node.js 图片去背景网站，调用 `remove.bg` API。

## 使用方式

1. 准备 Node.js 18 或更高版本。
2. 复制环境变量文件：

```bash
cp .env.example .env
```

3. 在 `.env` 中填入你的 API Key：

```env
REMOVE_BG_API_KEY=你的_remove_bg_api_key
PORT=3000
```

4. 启动：

```bash
npm start
```

5. 打开 `http://localhost:3000`

## 功能

- 前端上传图片
- 后端调用 remove.bg 去背景
- 页面直接预览结果
- 一键下载透明背景 PNG

## 说明

- 当前实现不依赖第三方 npm 包。
- 前端会先将图片转成 base64 再发给后端，适合简单场景。
- 建议上传 12MB 以内图片。
