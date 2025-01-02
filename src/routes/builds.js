import express from 'express';
const router = express.Router();

import {
  listObjects,
  moveToApproved,
  deleteObject,
  getObjectStream,
  uploadObject
} from "../services/minioService.js";

function sanitizeFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

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

export default router;
