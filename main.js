import { Command } from "commander";
import http from "http";
import fs from "fs/promises";
import { XMLBuilder } from "fast-xml-parser";

// 1) Параметри з консолі
const cmd = new Command();
cmd
  .requiredOption("-i, --input <path>", "шлях до JSON файлу")
  .requiredOption("-h, --host <host>", "адреса сервера")
  .requiredOption("-p, --port <port>", "порт сервера");
cmd.parse(process.argv);

const { input: file, host, port } = cmd.opts();

// 2) Читання JSON
async function readFileJson(path) {
  try {
    const text = await fs.readFile(path, "utf-8");
    return JSON.parse(text);
  } catch {
    // точний текст помилки за умовою
    throw new Error("Cannot find input file");
  }
}

// 3) HTTP-сервер
const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Method Not Allowed");
    }

    // Параметри запиту
    const url = new URL(req.url, `http://${req.headers.host}`);
    const addHumidity = url.searchParams.get("humidity") === "true";
    const minStr = url.searchParams.get("min_rainfall");
    const minRain = minStr !== null ? Number(minStr) : null;

    // Дані і фільтр
    const data = await readFileJson(file);
    let items = Array.isArray(data) ? data : [];
    if (minRain !== null && !Number.isNaN(minRain)) {
      items = items.filter(r => Number(r.Rainfall) > minRain);
    }

    // 4) Формування ЄДИНОГО кореня <weather_data>
    const builder = new XMLBuilder({ format: true });
    const xml = builder.build({
      weather_data: {
        record: items.map(r => ({
          rainfall: r.Rainfall,
          pressure3pm: r.Pressure3pm,
          ...(addHumidity ? { humidity: r.Humidity3pm } : {})
        }))
      }
    });

    res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
    res.end(xml);
  } catch (err) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(err.message);
  }
});

server.listen(Number(port), host, () => {
  console.log(`Server running at http://${host}:${port}`);
});

// no-op
