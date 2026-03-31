const http = require("http");
const fs = require("fs");
const path = require("path");

loadEnvFile();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.REMOVE_BG_API_KEY;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/remove-background") {
    await handleRemoveBackground(req, res);
    return;
  }

  if (req.method === "GET") {
    await serveStaticFile(req, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

async function handleRemoveBackground(req, res) {
  if (!API_KEY) {
    sendJson(res, 500, {
      error: "Missing REMOVE_BG_API_KEY. Add it to your environment or .env file.",
    });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const { imageBase64, filename, size } = body;

    if (!imageBase64 || !filename) {
      sendJson(res, 400, { error: "Missing image data." });
      return;
    }

    if (size && size > 12 * 1024 * 1024) {
      sendJson(res, 400, { error: "Image is too large. Please upload a file under 12MB." });
      return;
    }

    const buffer = Buffer.from(imageBase64, "base64");
    const formData = new FormData();
    const safeName = sanitizeFilename(filename);

    formData.append("image_file", new Blob([buffer]), safeName);
    formData.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      sendJson(res, response.status, {
        error: `remove.bg request failed: ${errorText}`,
      });
      return;
    }

    const resultBuffer = Buffer.from(await response.arrayBuffer());

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify({
        imageBase64: resultBuffer.toString("base64"),
        mimeType: "image/png",
        filename: `${path.parse(safeName).name}-no-bg.png`,
      })
    );
  } catch (error) {
    sendJson(res, 500, {
      error: error.message || "Unexpected server error.",
    });
  }
}

async function serveStaticFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const stat = await fs.promises.stat(filePath);
    const resolvedPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const ext = path.extname(resolvedPath).toLowerCase();
    const content = await fs.promises.readFile(resolvedPath);

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    sendJson(res, 500, { error: "Failed to load page." });
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let settled = false;

    req.on("data", (chunk) => {
      if (settled) {
        return;
      }

      data += chunk;

      if (data.length > 20 * 1024 * 1024) {
        settled = true;
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (settled) {
        return;
      }

      try {
        settled = true;
        resolve(JSON.parse(data || "{}"));
      } catch (error) {
        settled = true;
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    });
  });
}

function sanitizeFilename(filename) {
  return path.basename(filename).replace(/[^\w.\-]/g, "_") || "upload.png";
}

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
