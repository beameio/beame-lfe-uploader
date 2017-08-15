
var http = require('http');
var cf = require('aws-cloudfront-sign');
var express = require('express');
var router = express.Router();
var app = express();
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var config = require('./config.json');
var utils = require('./utils.js');
var mssql = require('mssql');

var Tracker = require('./uploadtracker.js');
var MuleUploader = require('./muleuploader.js');

//config AWS start
var awsConfig = {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucket: config.bucketName,
    region: 'us-east-1'
};

var AWS = require('aws-sdk');
AWS.config.update({accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey});
AWS.config.region = 'us-east-1';

var elastictranscoder = new AWS.ElasticTranscoder();

function createElasticTranscoderJob(inputKey, prefix, bcid, cb) {

    console.log('starting transcoder job');
    console.log('inputKey:' + inputKey);


    var createVideoId = utils.createVideoId;

    var rendId_1 = 'HLS_2M_' + createVideoId().toString(),
        rendId_2 = 'HLS_1_HLAF_M_' + createVideoId().toString(),
        rendId_3 = 'HLS_1M_' + createVideoId().toString(),
        rendId_4 = 'HLS_600K_' + createVideoId().toString(),
        rendId_5 = 'HLS_400K_' + createVideoId().toString(),
        rendId_6 = 'MP4_GEN_1080P_' + createVideoId().toString(),
        rendId_7 = 'MP4_GEN_720P_' + createVideoId().toString(),
        rendId_8 = 'MP4_GEN_480P_' + createVideoId().toString(),
        rendId_9 = 'MP4_GEN_360P_' + createVideoId().toString();

    var key1 = rendId_1 + '/' + rendId_1,
        key2 = rendId_2 + '/' + rendId_2,
        key3 = rendId_3 + '/' + rendId_3,
        key4 = rendId_4 + '/' + rendId_4,
        key5 = rendId_5 + '/' + rendId_5,
        key6 = rendId_6 + '/' + rendId_6 + '.mp4',
        key7 = rendId_7 + '/' + rendId_7 + '.mp4',
        key8 = rendId_8 + '/' + rendId_8 + '.mp4',
        key9 = rendId_9 + '/' + rendId_9 + '.mp4';

    var segmentDuration = '10';

    var setup = {
        PipelineId: config.pipelineId, // specifies output/input buckets in S3
        OutputKeyPrefix: prefix + bcid + "/",
        Input: {
            Key: inputKey,
            FrameRate: 'auto',
            Resolution: 'auto',
            AspectRatio: 'auto',
            Interlaced: 'auto',
            Container: 'auto'
        },
        UserMetadata: {
            bcId: bcid
        },
        Playlists: [
            {
                Format: 'HLSv3',
                Name: 'PL_' + bcid,
                OutputKeys: [key1, key2, key3, key4, key5]
            }
        ],
        Outputs: [

            {
                Key: key1,
                PresetId: '1351620000001-200010', // HLS 2M
                Rotate: 'auto',
                SegmentDuration: segmentDuration
            },
            {
                Key: key2,
                PresetId: '1351620000001-200020', // HLS 1.5M
                Rotate: 'auto',
                SegmentDuration: segmentDuration
            },
            {
                Key: key3,
                PresetId: '1351620000001-200030', // HLS 1M
                Rotate: 'auto',
                SegmentDuration: segmentDuration
            },
            {
                Key: key4,
                PresetId: '1351620000001-200040', // HLS 600k
                Rotate: 'auto',
                SegmentDuration: segmentDuration
            },
            {
                Key: key5,
                PresetId: '1351620000001-200050', // HLS 400k
                Rotate: 'auto',
                SegmentDuration: segmentDuration
            },
            {
                Key: key6,
                PresetId: '1435913540637-adauu0', // Custom generec 1080p still 480*360
                ThumbnailPattern: 'still-{count}',
                Rotate: 'auto'
            },
            {
                Key: key7,
                PresetId: '1435913635120-0n5cf3', // custom generic 720p thumb 120*90
                ThumbnailPattern: 'thumbnail-{count}',
                Rotate: 'auto'
            },
            {
                Key: key8,
                PresetId: '1351620000001-000020', // 480p 16:9
                Rotate: 'auto'
            },
            {
                Key: key9,
                PresetId: '1351620000001-000040', // 360p 16:9
                Rotate: 'auto'
            }
        ]

    };

    console.dir(setup);

    elastictranscoder.createJob(setup
        , function (error, data) {
            console.log('job started');
            if (error) {
                console.log(error, error.stack);
                cb({status: "ERR", msg: error.stack});
            }// an error occurred
            else {
                console.dir(data);
                cb({status: "OK", msg: ""})
            }           // successful response

        });
}
//config AWS end

//config Uploader start

//var sqlClient = mysql.createClient(sqlConfig);
var tracker = new Tracker(mssql);
var uploader = new MuleUploader(tracker, awsConfig);

//tracker.setupTracking();

//config Uploader start

// routes start


router.get('/signing_key/', function (req, res) {
    var file = {
        filename: req.query.filename,
        fileSize: req.query.filesize,
        lastModified: req.query.last_modified
    };

    var onKeyCreated = function (err, result) {
        //console.log('onKeyCreated', arguments);
        if (err) {
            res.send('err!');
        } else {
            res.json(result);
        }
    };

    if (req.query.force) {
        uploader.restartUpload(file, onKeyCreated);
    } else {
        uploader.startUpload(file, onKeyCreated);
    }
});

router.get('/chunk_loaded/', function (req, res) {
    var file = {
        filename: req.query.filename,
        fileSize: req.query.filesize,
        lastModified: req.query.last_modified
    };

    var chunk = Number(req.query.chunk);
    var key = req.query.key;
    var id = req.query.upload_id;

    var onChunkAdded = function (err) {
        var message = '';

        if (err) {
            message = 'error!';
        }

        res.send(message);
    };

    uploader.chunkUploaded(file, chunk, key, id, onChunkAdded);
});

router.get('/upload-completed/:uid/:bcid/:filename/', function (req, res) {
    var filename = req.params.filename || '';
    var uid = req.params.uid || '';
    var bcid = req.params.bcid || '';

    // console.log(' req.params' + req.params);
    createElasticTranscoderJob(uid + "/" + bcid + "/" + filename, uid + "/", bcid, function (result) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.json(result);
    });

});

app.get('/get-settings',function(req,res){
    res.send({
        bucket:config.bucketName,
        ak:config.accessKeyId
    });
});

app.get('/getSignedUrl', function (req, res) {
    var filePath = req.query.path;
    var signedUrl = getSignedUrl(filePath);
    res.send({url:signedUrl});
});

var getSignedUrl = function (filePath) {
    var options = {
        keypairId: config.cfKeyPairId,
        expireTime: (new Date().getTime() + 86400000),
        privateKeyPath: './cert/pk-cf.pem'
    };
    try {
        var signedUrl = cf.getSignedUrl(filePath, options);
       // console.log('Signed URL success', signedUrl);
        return signedUrl;
    } catch (err) {
        console.error('Signed URL error', err);
        return null;
    }
};
//routes end



app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use('/upload-backend', router);
app.use('/', express.static('public'));

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

var port = normalizePort(process.env.PORT || '8080');
var server = http.createServer(app);
server.listen(port);
