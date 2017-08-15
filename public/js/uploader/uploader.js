/**
 * Created by vaney on 7/4/15.
 */


var lfeUploader = lfeUploader || {};

var KB = 1024;
var MB = 1024 * KB;
var GB = 1024 * MB;

var Uploader = lfeUploader.Uploader = function Uploader(settings) {
    this.settings = {
        access_key: '',
        bucket: '',
        key: '',
        videoId:'',
        content_type: 'application/octet-stream',
        acl: 'public-read',
        region: 'us-east-1',
        max_size: 2 * GB,
        autostart: true,
        chunk_size: 6 * MB,
        num_workers: 4,
        ajax_base: '/upload-backend',
        signing_key_api: 'signing_key',
        chunk_loaded_api: 'chunk_loaded',
        accepted_extensions: ''
    };

    this.startMessageSent = false;

    settings = settings || {};

    lfeUploader.utils.extend_object(this.settings, settings);

   // console.log('uploader.js:: key received ' + this.settings.key);

    this.state = 'waiting';

    // trigger the init event callback
    if (this.onInit) {
        this.onInit.apply(this);
    }
    return this;
};

//Uploader.prototype.setKey = function (key) {
//    this.settings.key = key;
//    return this;
//};

Uploader.prototype.setVideoId = function (id) {
    this.settings.videoId = id;
    return this;
};

Uploader.prototype.getVideoId = function () {
    return this.settings.videoId;
};

Uploader.prototype.setState = function (state) {
    this.state = state;
    return this;
};

Uploader.prototype.getState = function () {
    return this.state;
};

Uploader.prototype.notifyStartMessage = function () {
    this.startMessageSent = true;
    return this;
};

Uploader.prototype.getStartMessageState = function () {
    return this.startMessageSent;
};

Uploader.prototype.setOnSelectCallback = function (callback) {
    this.onSelect = callback;
    return this;
};

Uploader.prototype.setOnInitCallback = function (callback) {
    this.onInit = callback;
    return this;
};

Uploader.prototype.setOnStartCallback = function (callback) {
    this.onStart = callback;
    return this;
};

Uploader.prototype.setOnProgressCallback = function (callback) {
    this.onProgress = callback;
    return this;
};

Uploader.prototype.setOnChunkProgressCallback = function (callback) {
    this.onChunkProgress = callback;
    return this;
};

Uploader.prototype.setOnChunkUploadedCallback = function (callback) {
    this.onChunkUploaded = callback;
    return this;
};

Uploader.prototype.setOnErrorCallback = function (callback) {
    this.onError = callback;
    return this;
};

Uploader.prototype.setOnCompleteCallback = function (callback) {
    this.onComplete = callback;
    return this;
};

Uploader.prototype.setFile = function (file) {
    this.file = file;
    return this;
};

Uploader.prototype.getFile = function () {
    return this.file;
};

Uploader.prototype.setProgress = function(chunk, loaded) {
    this._progress = this._progress || {};
    this._total_progress = (this._total_progress || 0 ) + loaded - (this._progress[chunk] || 0);
    this._progress[chunk] = loaded;
    if (this.onChunkProgress) {
        this.onChunkProgress.call(this, chunk, loaded, this.getChunkSize(chunk));
    }

    return this;
};

// gets the total bytes uploaded
Uploader.prototype.getTotalProgress = function() {
    return this._total_progress || 0;
};

// returns true if a chunk is already uploaded
Uploader.prototype.isChunkLoaded = function(chunk) {
    this._loaded_chunks = this._loaded_chunks || [];
    return this._loaded_chunks.indexOf(chunk) !== -1;
};

// adds a chunk to the uploaded list
Uploader.prototype.addLoadedChunk = function(chunk) {
    this._loaded_chunks = this._loaded_chunks || [];
    this._loaded_chunks.push(chunk);
    this.setProgress(chunk, this.getChunkSize(chunk));
};

// returns true if the chunk is currently uploading
Uploader.prototype.getChunkUploading = function(chunk) {
    this._uploading_chunks = this._uploading_chunks || [];
    return this._uploading_chunks.indexOf(chunk) !== -1;
};

// sets whether a chunk is currently uploading or not
Uploader.prototype.setChunkUploading = function(chunk, val) {
    if(typeof val == "undefined") {
        val = true;
    }
    this._uploading_chunks = this._uploading_chunks || [];
    if(val) {
        this._uploading_chunks.push(chunk);
    } else {
        var list = [];
        for(var i=0; i < this._uploading_chunks.length; i++) {
            if(this._uploading_chunks[i] != chunk) {
                list.push(this._uploading_chunks[i]);
            }
        }
        this._uploading_chunks = list;
    }
};

// initialize inner representation of chunks
Uploader.prototype.initChunks = function(force) {
    if(!this._chunks || force) {
        this._chunks = [];
        var num_chunks = Math.ceil(this.file.size / this.settings.chunk_size);
        for(var i=0; i < num_chunks; i++) {
            this._chunks.push(false);
        }
    }
};

// sets whether a chunk finished uploading
Uploader.prototype.setChunkFinished = function(chunk, val) {
    if(typeof val == 'undefined') {
        val = true;
    }
    this.initChunks();
    this._chunks[chunk] = val;
};

// get next chunk to be uploaded; if all chunks are done, return -1
Uploader.prototype.getNextChunk = function(chunk) {
    this.initChunks();
    if(chunk && !this._chunks[chunk] && !this.getChunkUploading(chunk)) {
        return chunk;
    }
    for(var i=0; i < this._chunks.length; i++) {
        if(!this._chunks[i] && !this.getChunkUploading(i)) {
            return i;
        }
    }
    return false;
};

Uploader.prototype.isLastChunk = function(chunk) {
    return Math.ceil(this.file.size / this.settings.chunk_size) - 1 == chunk;
};

Uploader.prototype.getChunkSize = function(chunk) {
    if(this.isLastChunk(chunk)) {
        return this.file.size % this.settings.chunk_size;
    } else {
        return this.settings.chunk_size;
    }
};

Uploader.prototype.isUploadFinished = function() {
    this.initChunks();
    for(var i=0; i < this._chunks.length; i++) {
        if(!this._chunks[i] || this.getChunkUploading(i)) {
            return false;
        }
    }
    return true;
};

Uploader.prototype.updateChunks = function(parts) {
    var loaded = [];
    var num_chunks = Math.ceil(this.file.size / this.settings.chunk_size);

    this.initChunks(true);
    this._uploading_chunks = [];
    this._loaded_chunks = [];

    var i;
    for(i=0; i < parts.length; i++) {
        var part_number = parseInt(parts[i][0], 10);
        this.addLoadedChunk(part_number - 1);
        this.setChunkFinished(part_number - 1);
        loaded.push(part_number - 1);
    }
    for(i=0; i < num_chunks; i++) {
        if(loaded.indexOf(i) === -1) {
            this.setProgress(i, 0);
        }
    }
};

Uploader.prototype.start = function (force) {
    if (this.file) {
        return uploadFile(this, force);
    } else {
        throw new Error('No file selected');
    }
};

Uploader.prototype.stop = function(callback) {

    if(!this._chunk_xhr) return;

    for(var i=0; i < this._chunk_xhr.length; i++) {
        try {
            if (this._chunk_xhr[i].request) {
                this._chunk_xhr[i].request.abort();
            } else {
                this._chunk_xhr[i].abort();
            }
        }
        catch(err){
            console.log('error on stop ' + err);
        }
    }
    this._intervals = this._intervals || {};
    for(var x in this._intervals) {
        if(this._intervals.hasOwnProperty(x)) {
            clearInterval(this._intervals[x]);
        }
    }

    this.setState('canceled');
    this._chunk_xhr = this._chunk_xhr || [];
    if (this.onProgress) {
        this.onProgress.call(this, 0, 0);
    }
    this._chunk_xhr = null;
    this._chunks = null;
    this._uploading_chunks = null;
    this._loaded_chunks = null;
    this._start_fired = false;
    this.upload_id = null;
    this._progress = null;
    this.setState('waiting');
    if(callback)
        callback();

};

Uploader.prototype.destroy = function () {
    this.stop();

    delete this;
};

Uploader.prototype.loadFile = function () {
    if(this.getState() != 'waiting') {
        return;
    }

    // make sure we only trigger the start event once
    if(!this._start_fired) {
        // trigger the start event callback
        if (this.onStart) {
            this.onStart.call(this, this.file);
        }

        // and also trigger a progress callback with 0%
        if (this.onProgress) {
            this.onProgress.call(this, 0, this.file.size);
        }

        this._start_fired = true;
    }

    // from now on, we are "processing" the file upload
    this.setState('processing');

    // at this point we may have some chunks already uploaded,
    // so we may trigger a progress callback with the reported progress
    if (this.onProgress) {
        this.onProgress.call(this, this.getTotalProgress(), this.file.size);
    }

    // get the next chunk
    var next_chunk = this.getNextChunk();

    if(next_chunk !== false) {
        // and start uploading it
        uploadChunk(this, next_chunk);
    } else if(this.isUploadFinished()) {
        // if we finished, trigger the upload finish sequence
        finishUpload(this);
    }

    for(var i=0; i < this.settings.num_workers - 1; i++) {
        next_chunk = this.getNextChunk();
        if(next_chunk !== false) {
            uploadChunk(this, next_chunk);
        } else {
            break;
        }
    }
};

var uploadFile = function (uploader, force) {
    if(uploader.getState() != "waiting") {
        return;
    }

    var file = uploader.getFile();

    file.lastModifiedDate = file.lastModifiedDate || new Date();

    if (uploader.file.size > uploader.settings.max_size) {
        throw new Error(
            ["The maximum allowed file size is ",
                (uploader.settings.max_size / GB),
                "GB. Please select another file."].join('')
        );
    }

    if (uploader.settings.accepted_extensions) {
        // get the file extension
        var file_extension = file.name.split('.').pop();

        // split the given extensions into an array
        var extensions_array = uploader.settings.accepted_extensions.split(',');

        // and match the extension against the given extension list
        var file_accepted = false;
        for(var i=0; i<extensions_array.length; i++) {
            if(file_extension == extensions_array[i]) {
                file_accepted = true;
                break;
            }
        }

        // if the file is not accepted, notify the user and return
        if(!file_accepted) {
            throw new Error(
                ["This file format is not accepted. ",
                    "Please use a file with an extension like ",
                    uploader.settings.accepted_extensions].join('')
            );
        }
    }

    if (uploader.onSelect) {
        uploader.onSelect.call(uploader, file);
    }

    var args = lfeUploader.utils.extend_object(uploader.settings.extra_params || {}, {
        filename: file.name,
        filesize: file.size,
        last_modified: file.lastModifiedDate.valueOf()
    });

    if(force) {
        args.force = true;
    }

    var xhr = new XHR({
        url: uploader.settings.ajax_base + '/' + uploader.settings.signing_key_api + '/',
        extra_params: args,
        load_callback: function (e) {
            var json = JSON.parse(e.target.responseText);
            json.date = new Date(json.date);

            //console.log('xhr callback ...');
            //console.log(json);
            //console.log('key before ='+ uploader.settings.key);

            uploader.auth = json;
            uploader.upload_id = json.upload_id;
            uploader._chunks = json.chunks;
            //uploader.settings.backup_key = uploader.settings.key;
            uploader.settings.key = json.key ||  uploader.settings.key;

            if (json.key) {
                var parts = json.key.split('/');
                if(parts.length > 1) uploader.setVideoId(parts[1]);
            }


            console.log('key after ='+ uploader.settings.key);

            if(!uploader.upload_id) {
                AmazonXHR.init(json, uploader.settings.key, file, function(e) {
                    var xml = e.target.responseXML;

                    var error = xml.getElementsByTagName('Error');

                    if (!error.length) {
                        uploader.upload_id = xml.getElementsByTagName('UploadId')[0].textContent;

                        uploader.loadFile();
                    }
                });
            } else {
                // resume a previus upload
                if(!force) {
                    // get the uploaded parts from S3
                    AmazonXHR.list(
                        uploader.auth,
                        uploader.file,
                        uploader.settings.key,
                        uploader.upload_id,
                        uploader.settings.chunk_size,
                        function (parts) {
                            for(var i=0; i<parts.length; i++) {
                                var chunk = parts[i][0] - 1;
                                uploader.setProgress(chunk, uploader.getChunkSize(chunk));
                                uploader.setChunkFinished(chunk);
                                uploader.setChunkUploading(chunk, false);
                            }
                            uploader.loadFile();
                        },
                        function() {
                            // if it fails, re-initiate the upload, and force
                            // it to start a new upload

                            console.log('xhr cb... with key start');
                            console.log(uploader.settings.key)

                            uploader.upload_id = null;
                            uploader._progress = null;
                            uploader._total_progress = null;
                            uploader._loaded_chunks = null;
                            uploader._uploading_chunks = null;
                            uploader._chunks = null;
                            //uploader.settings.key = uploader.settings.backup_key;

                            console.log('xhr cb... with key send');
                            console.log(uploader.settings.key)

                            uploadFile(uploader, file, true); // force reload
                        }
                    );
                } else {
                    // force-start the upload
                    uploader.loadFile();
                }
            }
        }
    });

    xhr.send();
};

var uploadChunk = function(uploader, chunk) {
    // make sure we're in processing mode
    if(uploader.getState() != 'processing') {
        return;
    }

    // also make sure we're not already uploading this chunk
    if(uploader.getChunkUploading(chunk)) {
        setTimeout(function() {
            var next_chunk = uploader.getNextChunk();
            if(next_chunk !== false) {
                uploadChunk(uploader, uploader.getNextChunk());
            }
        }, 1000);
        return;
    }

    uploader.setChunkUploading(chunk);

    // if we already uploaded this chunk, get to the next one
    // if there is no next chunk, finish the upload
    if(uploader.isChunkLoaded(chunk)) {
        var next_chunk = uploader.getNextChunk();
        if(next_chunk !== false) {
            uploadChunk(next_chunk);
        } else {
            if(uploader.isUploadFinished()) {
                finishUpload(uploader);
            }
        }
    }

    var length = uploader.settings.chunk_size;

    // get the start and end bytes for the needed chunk
    var start = chunk * length;
    var end = Math.min(start + length, uploader.file.size);

    // we need the last progress time in order to detect hanging
    // uploads
    var last_progress_time = new Date();
    uploader._intervals = uploader._intervals || {};


    // the "readystatechange" handler
    var stateChangeCallback = function(e) {
        // we care about the "done" event triggered while processing
        if(e.target.readyState != this.DONE || uploader.getState() != 'processing') {
            return;
        }

        // if we don't receive a 2XX response, trigger an error
        if(Math.floor(e.target.status / 100) != 2) {
            return errorCallback();
        }

        // notify the server of the uploaded chunk
        notifyChunkUploaded(uploader, chunk);

        if (uploader.onChunkUploaded) {
            uploader.onChunkUploaded.call(uploader, chunk);
        }

        // cancel the xhr watcher interval
        clearInterval(uploader._intervals[chunk]);

        // mark the chunk as finished
        uploader.setProgress(chunk, uploader.getChunkSize(chunk));
        uploader.setChunkFinished(chunk);
        uploader.setChunkUploading(chunk, false);

        // get next chunk; if we're out of chunks,
        // finish the upload
        var next_chunk = uploader.getNextChunk();
        if(next_chunk !== false) {
            uploadChunk(uploader, next_chunk);
        } else if(uploader.isUploadFinished()) {
            finishUpload(uploader);
        } else {
            var interval = setInterval(function() {
                var chunk = uploader.getNextChunk();
                if(chunk) {
                    clearInterval(interval);
                    uploadChunk(uploader, chunk);
                } else if(uploader.isUploadFinished()) {
                    clearInterval(interval);
                    finishUpload(uploader);
                }
            }, 1000);
        }
    };

    // the upload progress handler
    var progressCallback = function(e) {
        // set the internal chunk's progress value to the reported amount
        uploader.setProgress(chunk, e.loaded);

        // trigger the progress event callback
        if (uploader.onProgress) {
            uploader.onProgress.call(uploader, uploader.getTotalProgress(), uploader.file.size);
        }

        // update the last_progress_time for the watcher interval
        last_progress_time = new Date();
    };

    var error_handled = false;
    var errorCallback = function() {
        var xhr = this;
        // the upload may have finished, so check for that
        checkAlreadyUploaded(
            uploader,
            function() {
                // if already uploaded
                uploader.setState('finished');

                //uploader.notify_upload_finished();

                if (uploader.onProgress) {
                    uploader.onProgress.call(uploader, uploader.file.size, uploader.file.size);
                }

                if (uploader.onComplete) {
                    uploader.onComplete.call(uploader,uploader.file);
                }
            },
            function() {
            // make sure we don't handle the same error more than once
            if(error_handled) {
                return;
            }
            error_handled = true;

            // abort the chunk upload
            uploader.setChunkUploading(chunk, false);
            uploader.setChunkFinished(chunk, false);
            uploader.setProgress(chunk, 0);
            try {
                xhr.abort();
            } catch(e) {
            }

            // clear the watcher interval
            clearInterval(uploader._intervals[chunk]);

            // re-try the upload
            setTimeout(function() {
                if(uploader.getState() == 'processing') {
                    // and proceed
                    var next_chunk = uploader.getNextChunk(chunk);
                    if(next_chunk !== false) {
                        uploadChunk(uploader, next_chunk);
                    }
                }
            }, 1000);
        });
    };

    AmazonXHR.upload_chunk(
        uploader.auth,
        uploader.settings.key,
        uploader.upload_id,
        chunk,
        uploader.file.slice(start, end),
        {
            progress_callback: progressCallback,
            state_change_callback: stateChangeCallback,
            error_callback: errorCallback,
            timeout_callback: errorCallback
        },
        function(xhr) {
            uploader._chunk_xhr = uploader._chunk_xhr || [];
            uploader._chunk_xhr.push(xhr);

            // the watcher interval; it cancels the xhr if it times out
            uploader._intervals[chunk] = setInterval(function() {
                if(last_progress_time && (new Date() - last_progress_time) > 15000) { // 15s
                    clearInterval(uploader._intervals[chunk]);
                    if(uploader.getState() == 'processing') {
                        if (xhr.request) {
                            xhr.request.abort();
                        } else {
                            xhr.abort();
                        }

                        errorCallback.call(xhr);
                        uploader._chunk_xhr[uploader._chunk_xhr.indexOf(xhr)] = null;
                    }
                }
            }, 4000); // every 4s
        });
};

var finishUpload = function (uploader) {
    if(uploader.getState() != 'processing') {
        return;
    }

    uploader.setState('finishing');

    if (uploader.onProgress) {
        uploader.onProgress.call(uploader, uploader.file.size, uploader.file.size);
    }

    var requestList = function (callback) {
        AmazonXHR.list(
            uploader.auth,
            uploader.file,
            uploader.settings.key,
            uploader.upload_id,
            uploader.settings.chunk_size,
            callback);
    };

    var onFinish = function (e) {
        // i.e. if it's a 2XX response
        if (Math.floor(e.target.status / 100) == 2) {

            uploader.setState('finished');
            if (uploader.onProgress) {
                uploader.onProgress.call(uploader, uploader.file.size, uploader.file.size);
            }

            if (uploader.onComplete) {
                uploader.onComplete.call(uploader,uploader.file);
            }

        } else if(e.target.status == 400 && e.target.responseText.indexOf('EntityTooSmall') !== -1) {

            // an "EntityTooSmall" error means that we missed a chunk
            requestList(function(parts) {
                uploader.updateChunks(parts);
                var next_chunk = uploader.getNextChunk();
                uploader.setState('processing');
                uploadChunk(uploader, next_chunk);
            });

        } else if(e.target.status == 404) {

            // 404 = NoSuchUpload = check if already finished
            // if so, start a new upload
            uploader.stop(function() {
                uploadFile(uploader, uploader.file, true);
            });

        } else {
            checkAlreadyUploaded(function() {
                onFinish({
                    target: {
                        status: 200
                    }
                });
            }, function() {
                onFinish({
                    target: {
                        status: 404
                    }
                });
            });
        }
    };

    requestList(
        function onList(parts) {
            var num_chunks = Math.ceil(uploader.file.size / uploader.settings.chunk_size);

            // check that we uploaded all the chunks; if we didn't,
            // start uploading the missing ones
            if (parts.length != num_chunks) {
                uploader.updateChunks(parts);
                var next_chunk = uploader.getNextChunk();
                uploader.setState('processing');
                uploadChunk(uploader, next_chunk);
                return;
            }

            AmazonXHR.finish(
                uploader.auth,
                uploader.file,
                uploader.settings.key,
                uploader.upload_id,
                parts, uploader.settings.chunk_size,
                onFinish);
        }
    );
};

var checkAlreadyUploaded = function(uploader, callback, errorCallback) {
    var method = 'HEAD';
    var path = '/' + uploader.settings.key;
    var inner_handler = function (e) {
        // the handler only checks for status code;
        // if the HEAD returns 404, re-upload,
        // else, it returns 200 and finish the upload
        if(Math.floor(e.target.status / 100) == 2) {
            callback();
        } else {
            errorCallback();
        }
    };

    if(!errorCallback && typeof(errorCallback) !== 'function') {
        errorCallback = function() {
            setTimeout(function() {
                return checkAlreadyUploaded(callback, errorCallback);
            }, 2500);
        };
    }

    var host = 's3' + lfeUploader.utils.region_string(uploader.settings.region) + ".amazonaws.com";
    var url = location.protocol + '//' + host + '/' + uploader.settings.bucket + '/' + path;
    var xhr = new XHR({
        url: url,
        method: method,
        load_callback: inner_handler,
        error_callback: errorCallback
    });

    xhr.send();
};

var notifyChunkUploaded = function(uploader, chunk) {
    if(uploader.getState() != 'processing') {
        return;
    }
    var key = uploader.settings.key;
    var upload_id = uploader.upload_id;
    var url = uploader.settings.ajax_base + '/' + uploader.settings.chunk_loaded_api + '/';

    console.log('notify chunk uploaded with key =' + key);

    var args = lfeUploader.utils.extend_object(uploader.settings.extra_params || {}, {
        chunk: chunk,
        key: key,
        upload_id: upload_id,
        filename: uploader.file.name,
        filesize: uploader.file.size,
        last_modified: uploader.file.lastModifiedDate.valueOf()
    });

    var xhr = new XHR({
        url:url,
        extra_params:args
    });

    xhr.send();
};