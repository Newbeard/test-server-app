const express = require("express");
const fs = require("fs");
const path = require("path");
const { Client } = require("minio");

const app = express();
const PORT = 3001;

// Настройка MinIO
const minioClient = new Client({
  endPoint: "localhost",
  port: 9000,
  useSSL: false,
  accessKey: "minioadmin",
  secretKey: "minioadmin",
});

// Обслуживание статических файлов
app.use(express.static(path.join(__dirname)));

// Генерация большого файла и загрузка в MinIO
const ensureBucketExists = async (bucketName) => {
  const bucketExists = await minioClient.bucketExists(bucketName);
  if (!bucketExists) {
    console.log(`Bucket ${bucketName} does not exist. Creating...`);
    await minioClient.makeBucket(bucketName, "us-east-1");
    console.log(`Bucket ${bucketName} created successfully.`);
  }
};

const generateAndUploadFile = async () => {
  const bucketName = "mybucket";
  const fileName = "large-file.txt";
  const filePath = path.resolve(__dirname, fileName);

  try {
    // Убедитесь, что бакет существует
    await ensureBucketExists(bucketName);

    // Генерация большого файла (300 МБ)
    const writeStream = fs.createWriteStream(filePath);
    const fileSize = 300 * 1024 * 1024; // 300 МБ в байтах
    const chunk = "A".repeat(1024); // Один килобайт данных

    for (let i = 0; i < fileSize / chunk.length; i++) {
      writeStream.write(chunk);
    }
    writeStream.end();

    // После завершения записи загружаем файл в MinIO
    writeStream.on("finish", async () => {
      try {
        await minioClient.fPutObject(bucketName, fileName, filePath);
        fs.unlinkSync(filePath); // Удаляем локальный файл
        console.log("File generated and uploaded to MinIO successfully.");
      } catch (uploadError) {
        console.error("Error uploading to MinIO:", uploadError);
      }
    });
  } catch (error) {
    console.error("Error generating file:", error);
  }
};

// Роут для скачивания файла
app.get("/api/download-file", async (req, res) => {
  try {
    const bucketName = "mybucket";
    const fileName = "large-file.txt";

    // Получаем метаданные файла для определения размера
    const stat = await minioClient.statObject(bucketName, fileName);
    const fileSize = stat.size;

    // Установка заголовков для скачивания
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // Полное отключение кеша
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Передача файла через поток
    const stream = await minioClient.getObject(bucketName, fileName);
    stream.pipe(res);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).send({ message: "Error downloading file" });
  }
});

// Запуск сервера
app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);

  // Генерация и загрузка файла в MinIO при старте сервера
  await generateAndUploadFile();
});
