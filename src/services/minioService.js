import { Client } from "minio";

const BUCKET_NAME = "screenshots";

let minioClient = null;

const getMinioClient = () => {
  if (minioClient) return minioClient;

  minioClient = new Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
  });

  return minioClient;
}

const listObjects = async (prefix, recursive = false) => {
  const objects = [];
  const client = getMinioClient();
  const stream = client.listObjectsV2(BUCKET_NAME, prefix, recursive, '/');

  return new Promise((resolve, reject) => {
    // Handle each object in stream
    stream.on("data", (obj) => {
      if (obj.prefix) {
        objects.push({
          name: obj.prefix.replace(prefix, '').replace(/\/$/, ''),
          hash: null
        });
      } else {
        objects.push({
          name: obj.name.replace(`${prefix}/`, ''),
          hash: obj.etag.replace(/"/g, '')
        });
      }
    });

    // Handle stream completion
    stream.on("end", () => resolve(objects));

    // Handle potential errors
    stream.on("error", reject);
  });
};

const moveToApproved = async (buildId, testName) => {
  const client = getMinioClient();
  const buildPath = `builds/${buildId}/${testName}`;
  const approvedPath = `approved/${testName}`;

  const files = await listObjects(buildPath, true);

  for (const file of files) {
    const sourcePath = `${buildPath}/${file.name}`;
    const targetPath = `${approvedPath}/${file.name}`;

    await client.copyObject(
      BUCKET_NAME,
      targetPath,
      `${BUCKET_NAME}/${sourcePath}`
    );
  }
};

const deleteObject = async (buildId) => {
  const client = getMinioClient();
  const prefix = `builds/${buildId}/`;
  const objects = await listObjects(prefix, true);

  await client.removeObjects(BUCKET_NAME, objects.map(file => file.name));
};

const getObjectStream = async (objectPath) => {
  const client = getMinioClient();
  return await client.getObject(BUCKET_NAME, objectPath);
};

const uploadObject = async (path, buffer, contentType) => {
  const client = getMinioClient();
  await client.putObject(
    BUCKET_NAME,
    path,
    buffer,
    {
      'Content-Type': contentType
    }
  );
};

export {
  listObjects,
  moveToApproved,
  deleteObject,
  getObjectStream,
  uploadObject,
  getMinioClient
};
