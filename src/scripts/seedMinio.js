import 'dotenv/config';

import { getMinioClient } from '../services/minioService.js';
import fs from 'fs';
import path from 'path';

const client = getMinioClient();

function walkDir(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  items.forEach(item => {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...walkDir(fullPath));
    } else {
      files.push(fullPath);
    }
  });

  return files;
}

const baseDir = 'public/screenshots';
const files = walkDir(baseDir);

const seedData = files.map(filePath => ({
  bucket: 'screenshots',
  objectName: filePath.replace(`${baseDir}/`, ''),
  filePath: filePath
}));

async function uploadSeedFiles() {
  try {
    // Check if bucket exists
    const bucketExists = await client.bucketExists('screenshots');
    if (!bucketExists) {
      // Create bucket if it doesn't exist
      await client.makeBucket('screenshots');
      console.log('Bucket "screenshots" created successfully');
    }

    // Upload files
    for (const file of seedData) {
      try {
        await client.fPutObject(file.bucket, file.objectName, file.filePath);
        console.log(`File uploaded successfully: ${file.objectName}`);
      } catch (err) {
        console.error(`Error uploading file ${file.objectName}:`, err);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

uploadSeedFiles();
