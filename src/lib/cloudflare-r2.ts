import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

function getClient() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadFileToDrive(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  subFolder: string
): Promise<{ fileId: string; webViewLink: string }> {
  const client = getClient();
  const bucket = process.env.CLOUDFLARE_R2_BUCKET!;
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL!;

  const key = `${subFolder}/${fileName}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return {
    fileId: key,
    webViewLink: `${publicUrl}/${key}`,
  };
}

export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const client = getClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
      Key: fileId,
    })
  );
}