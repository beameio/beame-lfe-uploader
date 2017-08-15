var dateFormat = require('dateformat');
var crypto = require('crypto');

var CHUNK_SIZE = 6 * 1024 * 1024; // 6MB

module.exports = MuleUploader;

/**
 * Construct uploader from SQL connection, AWS connection, and chunk size.
 * @public
 */


function MuleUploader(tracker, awsSettings, mimeType) {
    this.tracker = tracker;
    this.aws = awsSettings;
    this.mimeType = mimeType || 'application/octet-stream';
}

/**
 * Record uploaded chunk and create upload tracking if necessary.
 * @public
 */
MuleUploader.prototype.chunkUploaded = function (file, chunk, key, id, cb) {
    if (file.fileSize <= CHUNK_SIZE) {
        this.tracker.removeTracking(file);
        return;
    }

    var self = this;

    this.tracker.getUpload(file, function (err, upload) {
        if (!err) {
            var isFirstChunk = upload === null;

            if (isFirstChunk) {
                self.tracker.track(file, chunk, key, id);
            } else {
                var chunks = addChunk(upload.chunks_uploaded, chunk);
                self.tracker.updateChunks(upload.id, chunks);
            }
        }

        cb(err);
    });
};

/**
 * Remove current upload tracking and return upload metadata.
 * @public
 */
MuleUploader.prototype.restartUpload = function (file, cb) {
    var response = createUploadResponse(
        this.aws.secretAccessKey,
        this.aws.accessKeyId,
        this.aws.region,
        this.aws.bucket,
        this.mimeType
    );

    this.tracker.removeTracking(file);
    cb(null, response);
};

/**
 * Return upload metadata.
 * @public
 */
MuleUploader.prototype.startUpload = function (file, cb) {
    var self = this;

    this.tracker.getUpload(file, function (err, upload) {
        if (err) {
            cb(err, null);
        }

        var response = createUploadResponse(
            self.aws.secretAccessKey,
            self.aws.accessKeyId,
            self.aws.region,
            self.aws.bucket,
            self.mimeType
        );

        if (upload) {
            response.key = upload.key;
            response.upload_id = upload.upload_id;
            response.chunks = chunksAsInts(upload.chunks_uploaded);
        }

        cb(err, response);
    });
};

/**
 * Create upload metadata object.
 * @private
 */
function createUploadResponse(secretKey, accessKey, region, bucket, mimeType) {
    var date = new Date();
    var signature = createSignature(formatDate(date), secretKey, region, 's3');
    var backupKey = generateBackupKey();

    return {
        "date": date.toISOString(),
        "signature": signature,
        "access_key": accessKey,
        "region": region,
        "bucket": bucket,
        "content_type": mimeType,
        "backup_key": backupKey
    };

}

/**
 * Create S3 signature.
 * @private
 */
function createSignature(date, secretKey, region, service) {
    var kDate = hmac('AWS4' + secretKey, date);
    var kRegion = hmac(kDate, region);
    var kService = hmac(kRegion, service);
    return hmac(kService, 'aws4_request', 'hex');
}

/**
 * Format date to YYYYMMDD format.
 * @private
 */
function formatDate(date) {
    return dateFormat(date.toISOString(), 'UTC:yyyymmdd');
}

function hmac(key, string, encoding) {
    return crypto.
    createHmac('sha256', key).
    update(string, 'utf8').
    digest(encoding);
}

/**
 * Add new chunk to chunks_uploaded
 * @private
 */
function addChunk(chunks, newChunk) {
    var list = chunks.split(',');
    list.push(newChunk);

    return uniqueElements(list).join(',');
}

/**
 * Convert chunks string into int array.
 * @private
 */
function chunksAsInts(chunks) {
    return chunks.split(',').map(Number);
}

/**
 * Return unique elements in the array.
 * @private
 */
function uniqueElements(arr) {
    return arr.filter(function (elem, pos) {
        return arr.indexOf(elem) == pos;
    });
}

/**
 * Generate a random backup key in the range 0 - 10,000,000,000.
 * @private
 */
function generateBackupKey() {
    return randomInt(0, 10000000000).toString();
}

/**
 * Generate random integer in range (a, b).
 * @private
 */
function randomInt(a, b) {
    return Math.floor(Math.random() * b) + a;
}
