import 'dotenv/config';
import 'express-async-errors';
import express from "express";
import { authenticate } from "./middleware/authMiddleware.js";
import buildsRouter from "./routes/builds.js";
import path from 'path';
import { fileURLToPath } from 'url';
import fileUpload from 'express-fileupload';
import { errorHandler } from "./middleware/errorHandler.js";

// Get current file directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(express.json());
app.use(authenticate);
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
}));

// API Routes
app.use("/api/builds", buildsRouter);

// Error handling - should be after all routes
app.use(errorHandler);

// Serve static files
app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
