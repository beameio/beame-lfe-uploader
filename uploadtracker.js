module.exports = Tracker;
var config = require('./config.json');
var mssql;// = require('mssql');
var mssqlConfig = {
    user: config.mssqlUser,
    password: config.mssqlPwd,
    server: config.mssqlHost,
    database: config.mssqlDbName
};
/**
 * Constructs tracker from SQL connection.
 * @public
 */
function Tracker(_mssql) {
    mssql = _mssql;
}

//var createNewRequest = function () {
//    return new mssql.Request();
//};

/**
 * Create uploads table for tracking chunks.
 * @public
 */
/**
 * Update uploaded chunks of upload.
 * @public
 */
var runQuery = function (query, cb) {
    var connection = new mssql.connect(mssqlConfig, function (err) {
        var request = new mssql.Request(connection);
        request.query(query, function (err, recordset) {
            if (cb) {
                cb(err, recordset);
            }
            connection.close();
        });
    });
};

Tracker.prototype.updateChunks = function (id, chunks) {
    var UPDATE_CHUNKS =
            "UPDATE upload" +
            " SET chunks_uploaded = '" + chunks + "'" +
            " WHERE id = " + id
        ;

    runQuery(UPDATE_CHUNKS);
    //this.client.query(UPDATE_CHUNKS, [chunks, id]);
};

/**
 * Load upload metadata.
 * @public
 */
Tracker.prototype.getUpload = function (file, cb) {
    var SELECT_UPLOAD =
        "SELECT TOP 1 * FROM upload" +
        " WHERE filename = '" + file.filename + "' AND filesize = '" + file.fileSize + "' AND last_modified = '" + file.lastModified + "'" +
        " ORDER BY id DESC ";

    var onRowLoaded = function (err, rows) {
        if (err) {
            console.log('onRowLoaded', err);
            cb(err, null);
            return;
        }

        var upload = rows.length == 1
            ? rows[0]
            : null;

        cb(err, upload);
    };

    runQuery(
        SELECT_UPLOAD,
        onRowLoaded
    );
};

/**
 * Create entry to track upload.
 * @public
 */
Tracker.prototype.track = function (file, chunks, key, id) {
    var INSERT_UPLOAD =
        "INSERT INTO upload" +
        "(filename, filesize, last_modified, chunks_uploaded,video_key, upload_id) " +
        " VALUES ('" + file.filename + "', '" + file.fileSize + "', '" + file.lastModified + "',  '" + chunks + "',  '" + key + "',  '" + id + "')";

    runQuery(INSERT_UPLOAD);

};

/**
 * Delete upload tracking.
 * @public
 */
Tracker.prototype.removeTracking = function (file) {
    var DELETE_UPLOAD =
            "DELETE FROM upload " +
            " WHERE filename = '" + file.filename + "'" +
            " AND filesize = '" + file.fileSize + "'" +
            " AND last_modified = '" + file.lastModified + "'"
        ;

    runQuery(DELETE_UPLOAD);
};
