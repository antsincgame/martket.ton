'use strict';

const { S3Client } = require('@aws-sdk/client-s3');
const { logger } = require('../logger');

let _client = null;

function isR2Configured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

function getR2Client() {
  if (_client) return _client;

  if (!isR2Configured()) {
    logger.warn('R2 not configured — file upload/download will be unavailable');
    return null;
  }

  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  logger.info('R2 S3 client initialized');
  return _client;
}

function getBucketName() {
  return process.env.R2_BUCKET_NAME || 'ton-store-builds';
}

module.exports = { getR2Client, getBucketName, isR2Configured };
