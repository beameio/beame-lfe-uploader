/**
 * Created by vaney on 7/4/15.
 */

var bucketName,accessKey;

var xhr = new XHR({
    url: '/get-settings',
    method: 'GET',
    load_callback: function(e){
        try{
            if(e.target.status == 200){
                var resp = JSON.parse(e.target.response);
                bucketName = resp.bucket;
                accessKey = resp.ak;
            }
        }
        catch(err){
            console.log('get bucket name parse error',err);
        }
    },
    error_callback: function(err){
        console.log('get bucket name error',err);
    }
});

xhr.send();


var ALLOWED_EXT = ['.mov', '.mpg', '.mpeg4', '.mpeg', '.mp4', '.mv4', '.wmv', '.avi', '.ogv', '.3gp', '.3g2', '.h264','.qt','.flv'];

var logger = new element(document.getElementById('logger'));
var template = document.getElementById('file-template').innerHTML;

var bind = function(func, context) {
    return function() {
        return func.apply(context, arguments);
    };
};

function createVideoId(uid) {
    var videoId = Math.round(Date.now() * Math.random());
    if(uid != null)
    {
        return  videoId.toString() + uid.toString();
    }
    return videoId;
}


function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

var format_size = function(num_bytes) {
    if(num_bytes <= 1024 * 0.8) {
        return num_bytes + ' B';
    } else if(num_bytes <= 1024 * 1024 * 0.8) {
        return parseInt(num_bytes / 1024, 10) + '.' + parseInt(num_bytes / 1024 * 10, 10) % 10 + ' KB';
    } else if(num_bytes <= 1024 * 1024 * 1024 * 0.8) {
        return parseInt(num_bytes / 1024 / 1024, 10) + '.' + parseInt(num_bytes / 1024 / 1024 * 10, 10) % 10 + ' MB';
    } else {
        return parseInt(num_bytes / 1024 / 1024 / 1024, 10) + '.' + parseInt(num_bytes / 1024 / 1024 / 1024 * 10, 10) % 10 + ' GB';
    }
};

var onError = function() {
    this.$fileRow.find('.file-status')[0].addClass('error').html('Error occurred!');
};

var onSelect = function(fileObj) {
    var $this = this;
   // console.log('... on select')
    //console.log(fileObj);

    if (!$this.$fileRow) {
        $this.$fileRow = new element(template);
        $this.$fileRow.find('.file-name')[0].html(fileObj.name);
        logger.append($this.$fileRow);

        var cancel = $this.$fileRow.find('.cancel-upload')[0];
        cancel.on('click', bind(
                function () {
                    $this.destroy();
                },
                $this
            ));
    }
};

var fileObjectToToken = function(fileObj){
    return fileObj == undefined  ? null : {
        "name":fileObj.name,
        "size":fileObj.size,
        "type":fileObj.type
    };
};

var onStart = function(fileObj) {
    var $this = this;

    $this.$fileRow.find('.file-status')[0].html('Upload started');

    //console.log(this);
    //console.log('videoId=' + this.getVideoId());
    var isSent = $this.getStartMessageState();

    if(isSent) return;

    var token = {
        "action":"start",
        "vid":$this.getVideoId(),
        "file" : fileObjectToToken(fileObj)
    };

    $this.notifyStartMessage();

    var msg = JSON.stringify(token);

    //console.log('uploader start cb')
   // console.log(msg);
    console.log('post message to parent onStart',msg);
    parent.postMessage(msg,"*");
};

var onProgress = function(bytes_uploaded, bytes_total) {
    if(!this.settings.last_update || (new Date - this.settings.last_update) > 1000) {
        var percent = bytes_uploaded / bytes_total * 100;
        var speed = (bytes_uploaded - this.settings.last_uploaded) / (new Date - this.settings.last_update) * 1000;
        this.settings.last_update = new Date;
        this.settings.last_uploaded = bytes_uploaded;
        var log = 'Upload progress: ' + format_size(bytes_uploaded) + ' / '
            + format_size(bytes_total) + ' (' + parseInt(percent, 10) + '.' + parseInt(percent * 10, 10) % 10
            + '%)';
        if(speed) {
            log += '; speed: ' + format_size(speed) + '/s';
        }
        this.$fileRow.find('.file-status')[0].html(log);

        var text = parseInt(bytes_uploaded / bytes_total * 100) + '%';
        this.$fileRow.find('.progress .progress-bar')[0].attr('style', 'width: ' + (bytes_uploaded / bytes_total * 100) + '%').html(text);
    }
};

var onInit = function() {
    this.$fileRow.find('.file-status')[0].html('Uploader initialized');
};

var onComplete = function(fileObj) {
    var $this = this;

    //var url = 'http://testlfe.s3.amazonaws.com/' + this.settings.key;

    $this.$fileRow.find('.file-status')[0].html('Upload complete!<br>');
    $this.$fileRow.find('.progress')[0].removeClass('active');


    //console.log('on upload complete');
    //console.log(fileObj);

    var token = {
        "action":"complete",
        "vid":$this.getVideoId(),
        "file":fileObjectToToken(fileObj)
    };

  //  console.log(token);

    var msg = JSON.stringify(token);
    console.log('post message to parent onComplete',msg);
    parent.postMessage(msg,"*");

    this.destroy();
};

var onChunkUploaded = function() {
    //this.$fileRow.find('.file-status')[0].html('Chunk finished uploading');
};

var getSettings = function () {
    return {
        last_update: null,
        last_uploaded: null,
        access_key: accessKey,
        bucket: bucketName
        //,accepted_extensions:"mov,mpg,mpeg4,mpeg,mp4,mv4,wmv,avi,ogv,3gp,3g2,h264,qt,flv"
    };
};

var input = new element(document.getElementById('files'));

input.on('change', function () {
    var files = input.el.files;

    var uid = getParameterByName('uid') || 422;

    if(uid == undefined || uid.length === 0){
        alert('User required');
        return;
    }

    for (var i = 0; i < files.length; i++) {
        var file = files[i];

        var ext = file.name.substring(file.name.lastIndexOf('.'));
        console.log('ext=' + ext);

        if (ALLOWED_EXT.lastIndexOf(ext.toLocaleLowerCase()) < 0) {
            console.log('illegal file extension' + ext);
            var token = {
                "action":"error",
                "message":"illegal file extension:" + ext
            };

            var msg = JSON.stringify(token);
            console.log('post message to parent',msg);
            parent.postMessage(msg,"*");

        }
        else
        {
            var videoId = createVideoId(uid);

            var key = uid + '/' + videoId + '/' + file.name;

            var settings = getSettings();

            settings.content_type = file.type  || "application/octet-stream";
            settings.key = key;

            console.log('... init uploader instance');
            console.log('key = ' + key +'; videoId=' + videoId);

            new lfeUploader.Uploader(settings)
                .setFile(file)
                //.setKey(key)
                .setVideoId(videoId)
                .setOnErrorCallback(onError)
                .setOnSelectCallback(onSelect)
                .setOnStartCallback(onStart)
                .setOnProgressCallback(onProgress)
                .setOnInitCallback(onInit)
                .setOnCompleteCallback(onComplete)
                .setOnChunkUploadedCallback(onChunkUploaded)
                .start(false);
        }

    }
});