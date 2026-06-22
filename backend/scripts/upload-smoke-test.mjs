import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/utils/prisma.js';

const BASE = process.env.BASE_URL || 'http://localhost:10000';

async function main() {
  console.log('Starting upload smoke test against', BASE);

  // 1) Create guest creator session
  console.log('Creating guest creator session...');
  const creatorRes = await axios.post(`${BASE}/api/public/guest/creator`, {}).catch((e) => { throw new Error('guestCreator failed: ' + (e.response?.data?.error || e.message)); });
  const guestCreator = creatorRes.data.guest || creatorRes.data;
  const creatorToken = guestCreator?.token || creatorRes.data?.token;
  if (!creatorToken) throw new Error('No creator token returned');
  console.log('Creator token received');

  // 2) Create a guest trip using the creator token
  console.log('Creating guest trip...');
  const tripRes = await axios.post(`${BASE}/api/public/guest/trips`, { title: 'Smoke Test Trip', destination: 'Localhost' }, { headers: { 'x-guest-token': creatorToken } }).catch((e) => { throw new Error('guestCreateTrip failed: ' + (e.response?.data?.error || e.message)); });
  const trip = tripRes.data.trip;
  if (!trip || !trip.qrToken) throw new Error('Trip creation did not return qrToken');
  console.log('Trip created with qrToken:', trip.qrToken);

  // 3) Prepare a tiny PNG buffer (1x1 transparent)
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgk1q6SIAAAAASUVORK5CYII=';
  const buf = Buffer.from(pngBase64, 'base64');

  // 4) Upload to the trip QR endpoint with idempotency key
  const idempotencyKey = `smoke-${Date.now()}`;
  const form = new FormData();
  form.append('file', buf, { filename: 'smoke.png', contentType: 'image/png' });
  form.append('idempotencyKey', idempotencyKey);

  console.log('Uploading file to QR upload endpoint...');
  const uploadUrl = `${BASE}/api/public/qr/${trip.qrToken}/uploads`;
  const uploadRes = await axios.post(uploadUrl, form, { headers: { ...form.getHeaders(), 'x-guest-token': creatorToken }, maxBodyLength: Infinity }).catch((e) => {
    console.error('Upload failed response:', e.response?.status, e.response?.data);
    throw new Error('Upload failed: ' + (e.response?.data?.error || e.message));
  });

  console.log('Upload response status:', uploadRes.status);
  console.log('Upload response body:', uploadRes.data);

  const savedId = uploadRes.data?.upload?.id || uploadRes.data?.upload?.id || uploadRes.data?.upload?.id || uploadRes.data?.id || uploadRes.data?.upload?.id;
  console.log('Uploaded saved id:', savedId);

  // 5) Verify DB entries for UploadState and Upload
  const state = await prisma.uploadState.findFirst({ where: { idempotencyKey } });
  console.log('UploadState:', state ? { id: state.id, status: state.status, uploadId: state.uploadId } : null);
  if (!state) throw new Error('UploadState not found for idempotencyKey');

  const upload = state.uploadId ? await prisma.upload.findUnique({ where: { id: state.uploadId } }) : null;
  console.log('Upload row:', upload ? { id: upload.id, fileUrl: upload.fileUrl, status: upload.status } : null);

  console.log('Smoke test completed successfully');
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exitCode = 2;
});
