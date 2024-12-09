const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const yaml = require("yaml");

const app = express();
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "User-Agent"],
    credentials: true,
  })
);

// yml 파일 서비스를 위한 라우트 수정
app.get("/latest-mac.yml", (req, res) => {
  const ymlPath = path.join(__dirname, "release/latest-mac.yml");
  console.log("yml 파일 요청:", ymlPath);

  if (fs.existsSync(ymlPath)) {
    try {
      const content = fs.readFileSync(ymlPath, "utf8");
      const ymlData = yaml.parse(content);
      console.log("현재 yml 버전 정보:", {
        version: ymlData.version,
        releaseDate: ymlData.releaseDate,
        files: ymlData.files.map((f) => ({
          name: path.basename(f.url),
          size: f.size,
        })),
      });
      res.sendFile(ymlPath);
    } catch (err) {
      console.error("yml 파일 읽기/파싱 실패:", err);
      res.status(500).send("Error reading yml file");
    }
  } else {
    console.error("yml 파일을 찾을 수 없음:", ymlPath);
    res.status(404).send("Update file not found");
  }
});

// 에러 핸들링 추가
app.use((err, req, res, next) => {
  console.error("서버 에러:", err);
  res.status(500).json({
    error: "업데이트 서버 오류",
    details: err.message,
  });
});

// 업데이트 정보를 제공하는 엔드포인트
app.get("/update/:platform/:version", (req, res) => {
  const { platform, version } = req.params;

  try {
    const ymlPath = path.join(__dirname, "release/latest-mac.yml");
    const ymlContent = fs.readFileSync(ymlPath, "utf8");
    const updateInfo = yaml.parse(ymlContent);
    const latestVersion = updateInfo.version;

    // 버전 비교 로직
    const currentVersion = version.replace(/^v/, "");
    if (currentVersion >= latestVersion) {
      console.log("현재 버전이 최신 버전보다 같거나 높음:", {
        current: currentVersion,
        latest: latestVersion,
      });
      res.status(204).send();
      return;
    }

    console.log("업데이트 필요:", {
      current: currentVersion,
      latest: latestVersion,
    });

    if (platform === "darwin") {
      // Mac용 업데이트 정보를 yml 파일에서 직접 가져옴
      const macUpdateInfo = {
        version: updateInfo.version,
        files: updateInfo.files.map((file) => ({
          url: `./download/${path.basename(file.url)}`,
          sha512: file.sha512,
          size: file.size,
        })),
        path: updateInfo.path,
        sha512: updateInfo.sha512,
        releaseDate: updateInfo.releaseDate,
      };
      res.json(macUpdateInfo);
    } else if (platform === "win32") {
      // Windows용 업데이트 정보는 별도의 yml 파일이 필요함
      res
        .status(400)
        .json({ error: "Windows 업데이트 정보가 아직 준비되지 않았습니다." });
    } else {
      res.status(400).json({ error: "지원하지 않는 플랫폼입니다." });
    }
  } catch (error) {
    console.error("업데이트 정보 처리 중 오류:", error);
    res.status(500).json({ error: "업데이트 정보를 처리할 수 없습니다." });
  }
});

// 업데이트 파일 제공을 위한 정적 파일 서버 수정
app.get("/download/:file", (req, res) => {
  const filePath = path.join(__dirname, "release", req.params.file);
  console.log("요청된 파일 경로:", filePath);
  console.log("파��� 존재 여부:", fs.existsSync(filePath));

  // 파일 상세 정보 로깅
  try {
    const stats = fs.statSync(filePath);
    console.log("파일 정보:", {
      size: stats.size,
      permissions: stats.mode,
      created: stats.birthtime,
      modified: stats.mtime,
    });
  } catch (err) {
    console.error("파일 정보 읽기 실패:", err);
  }

  if (fs.existsSync(filePath)) {
    console.log("파일 전송 시작:", filePath);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error("파일 전송 실패:", err);
        res.status(500).send("Error sending file");
      } else {
        console.log("파일 전송 완료");
      }
    });
  } else {
    console.log("파일 없음:", filePath);
    try {
      const releaseDir = path.join(__dirname, "release");
      const files = fs.readdirSync(releaseDir);
      console.log("release 디렉토리 내용:", files);
    } catch (err) {
      console.error("디렉토리 읽기 실패:", err);
    }
    res.status(404).send("Update file not found");
  }
});

app.get("/", (req, res) => {
  res.send("Hello World");
});

// 서버 시작 시 디렉토리 확인
const releaseDir = path.join(__dirname, "release");
console.log("서버 시작 - release 디렉토리 확인");
console.log("release 디���토리 경로:", releaseDir);
console.log("release 디렉토리 존재 여부:", fs.existsSync(releaseDir));

if (fs.existsSync(releaseDir)) {
  try {
    const files = fs.readdirSync(releaseDir);
    console.log("release 디렉토리 내용:", files);
  } catch (err) {
    console.error("디렉토리 읽기 실패:", err);
  }
}

const PORT = process.env.UPDATE_SERVER_PORT || 3000;
app.listen(PORT, () => {
  console.log(`업데이트 서버가 포트 ${PORT}에서 실행 중입니다`);
});

// Netlify Functions로 내보내기
module.exports.handler = serverless(app);
