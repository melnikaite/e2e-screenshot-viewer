import express from 'express';
import OpenAI from 'openai';
import sharp from 'sharp';
import { toFile } from 'openai/uploads';
const router = express.Router();

import {
  listObjects,
  moveToApproved,
  deleteObject,
  getObjectStream,
  getObjectBuffer,
  uploadObject,
} from "../services/minioService.js";

// Routes with async handlers
router.get("/", async (req, res) => {
  const builds = await listObjects("builds/");
  res.json(builds.map(obj => obj.name));
});

router.get("/:buildId/tests", async (req, res) => {
  const { buildId } = req.params;
  const tests = await listObjects(`builds/${buildId}/`);
  res.json(tests.map(obj => obj.name));
});

router.get("/:buildId/tests/:testName/screenshots", async (req, res) => {
  const { buildId, testName } = req.params;
  const buildScreenshots = await listObjects(`builds/${buildId}/${testName}`, true);
  const approvedScreenshots = await listObjects(`approved/${testName}`, true);

  res.json({
    buildScreenshots,
    approvedScreenshots
  });
});

router.post("/:buildId/tests/:testName/approve", async (req, res) => {
  const { buildId, testName } = req.params;
  await moveToApproved(buildId, testName);
  res.json({ success: true });
});

router.delete("/:buildId", async (req, res) => {
  const { buildId } = req.params;
  await deleteObject(buildId);
  res.json({ success: true });
});

router.get("/screenshot", async (req, res) => {
  const { path } = req.query;

  if (!path) {
    throw new Error("Path parameter is required");
  }

  res.setHeader('Cache-Control', 'public, max-age=604800');
  res.setHeader('Expires', new Date(Date.now() + 604800000).toUTCString());

  const stream = await getObjectStream(path);
  stream.pipe(res);
});

router.post("/:buildId/tests/:testName/upload", async (req, res) => {
  const { buildId, testName } = req.params;
  const fileName = req.query.name;

  if (!req.files?.screenshot) {
    throw new Error("No screenshot file provided");
  }

  const sanitizedBuildId = sanitizeFileName(buildId);
  const sanitizedTestName = sanitizeFileName(testName);
  const sanitizedFileName = sanitizeFileName(fileName);

  const file = req.files.screenshot;
  const path = `builds/${sanitizedBuildId}/${sanitizedTestName}/${sanitizedFileName}`;

  await uploadObject(path, file.data, file.mimetype);
  res.json({ success: true, path: path });
});

router.post("/compare-images", async (req, res) => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { image1Url, image2Url } = req.body;

  if (!image1Url || !image2Url) {
    throw new Error("Invalid image paths");
  }

  // Get image buffers from Minio
  const buffer1 = await getObjectBuffer(image1Url);
  const buffer2 = await getObjectBuffer(image2Url);

  // Compare buffers directly
  if (buffer1.equals(buffer2)) {
    return res.json({ regions: [] });
  }

  // Get dimensions for regions
  const { width, height } = await sharp(buffer1).metadata();

  // Get analysis from OpenAI only if images are different
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a QA expert analyzing E2E test screenshots.

        IMPORTANT: Never return regions that cover the entire image or large portions of it.
        If unsure about exact difference location - return empty regions array.

        Task:
        1. Compare images pixel by pixel
        2. If identical (ignoring compression) - return empty regions array
        3. If different:
           - Find exact coordinates of each difference
           - Highlight only the specific changed pixels
           - Region size must be significantly smaller than image size

        Severity:
        - critical: Missing/broken functionality
        - minor: Visual changes affecting UX
        - visual: Minor cosmetic differences

        Use "Current Build" and "Approved Version" in descriptions.`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Compare these two E2E test screenshots and determine if they are identical:
            - Current Build: The new version being tested
            - Approved Version: The reference baseline
            - Ignore minor compression artifacts
            - Return empty regions array if images are identical or nearly identical

            Image dimensions: ${width}x${height} pixels

            Return a JSON with:
               - regions: array of differences to highlight (empty array if identical)
               {
                 x: number,      // x coordinate of difference
                 y: number,      // y coordinate of difference
                 width: number,  // width of difference area
                 height: number, // height of difference area
                 description: string,  // Use "Current Build" and "Approved Version" in descriptions
                 severity: "critical" | "minor" | "visual"
               }

            Important: Return empty regions array if images are identical or have only compression artifacts.`
          },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${buffer1.toString('base64')}` }
          },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${buffer2.toString('base64')}` }
          }
        ]
      }
    ],
    max_tokens: 1000,
    temperature: 0.1,
    response_format: { type: "json_object" }
  });

  const content = JSON.parse(response.choices[0].message.content);
  res.json(content);
});

export default router;
