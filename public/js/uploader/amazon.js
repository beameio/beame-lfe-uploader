var AmazonXHR = function(settings) {
    this.settings = settings;
};
AmazonXHR.finish = function(auth, file, key, upload_id, parts, chunk_size, callback) {
    var querystring = {"uploadId": upload_id};

    // compose the CompleteMultipartUpload request for putting
    // the chunks together
    var data = "<CompleteMultipartUpload>";
    for(var i=0; i<parts.length; i++) {
        data += "<Part>";
        data += "<PartNumber>" + parts[i][0] + "</PartNumber>";
        data += "<ETag>" + parts[i][1] + "</ETag>";
        data += "</Part>";
    }
    data += "</CompleteMultipartUpload>";

    // firefox requires a small hack
    if(navigator.userAgent.indexOf("Firefox") !== -1) {
        data = new Blob([data]);
    }

    return new AmazonXHR({
        auth: auth,
        key: key,
        method: "POST",
        querystring: querystring,
        headers: {},
        payload: data,
        load_callback: callback
    }).send();
};
AmazonXHR.list = function(auth, file, key, upload_id, chunk_size, callback, error_callback, marker) {
    var querystring = {"uploadId": upload_id};
    if(marker) {
        querystring['part-number​-marker'] = marker;
    }
    return new AmazonXHR({
        auth: auth,
        key: key,
        method: "GET",
        querystring: querystring,
        headers: {},
        payload: "",
        error_callback: function(er){
            console.log('AmazonXHR.list',er);
            if(error_callback) {
                error_callback(er);
            }
        },
        load_callback: function(e) {
            if(e.target.status === 404) {
                // i.e. the file was already uploaded; start fresh
                if(error_callback) {
                    error_callback();
                }
                return;
            }

            // process the parts, and return an array of
            // [part_number, etag, size] through the given callback
            window.debug = e;
            var xml = e.target.responseXML;
            var parts = [];
            var xml_parts = xml.getElementsByTagName("Part");
            var num_chunks = Math.ceil(file.size / chunk_size);
            for(var i=0; i < xml_parts.length; i++) {
                var part_number = parseInt(xml_parts[i].getElementsByTagName("PartNumber")[0].textContent, 10);
                var etag = xml_parts[i].getElementsByTagName("ETag")[0].textContent;
                var size = parseInt(xml_parts[i].getElementsByTagName("Size")[0].textContent, 10);

                if(part_number != num_chunks && size != chunk_size) {
                    continue; // chunk corrupted
                } else if(part_number == num_chunks &&
                    size != file.size % chunk_size) {
                    continue; // final chunk corrupted
                }

                parts.push([
                    part_number,
                    etag,
                    size
                ]);
            }
            var is_truncated = xml.getElementsByTagName("IsTruncated")[0].textContent;
            if(is_truncated === "true") {
                var part_marker = xml.getElementsByTagName("NextPartNumberMarker")[0].textContent;
                AmazonXHR.list(auth, key, upload_id, chunk_size, function(new_parts) {
                    callback(parts.concat(new_parts));
                }, error_callback, part_marker);
            } else {
                callback(parts);
            }
        }
    }).send();
};

AmazonXHR.upload_chunk = function(auth, key, upload_id, chunk_num, chunk, callbacks, xhr_callback) {
    var callback, error_callback, progress_callback, readystate_callback;
    if(callbacks instanceof Object) {
        callback = callbacks.load_callback;
        error_callback = callbacks.error_callback;
        progress_callback = callbacks.progress_callback;
        readystate_callback = callbacks.state_change_callback;
    } else {
        callback = callbacks;
    }
    var querystring = {
        partNumber: chunk_num + 1,
        uploadId: upload_id
    };

    //console.log('AmazonXHR.upload_chunk with key ' + key);

    return (new AmazonXHR({
        auth: auth,
        key: key,
        method: "PUT",
        querystring: querystring,
        headers: {},
        payload: chunk,
        load_callback: callback,
        error_callback: error_callback,
        progress_callback: progress_callback,
        state_change_callback: readystate_callback
    })).send(xhr_callback);
};
AmazonXHR.init = function(auth, key, file, callback) {

    //console.log('AmazonXHR.init with key ' + key);

    return new AmazonXHR({
        auth: auth,
        key: key,
        method: "POST",
        querystring: {
            "uploads": ""
        },
        headers: {
            "x-amz-acl": "public-read",
            "Content-Disposition": "attachment; filename=" + file.name,
            "Content-Type": file.type || "application/octet-stream" //auth.content_type
        },
        payload: "",
        load_callback: callback
    }).send();
};
AmazonXHR.prototype = {
    send: function(callback) {
        var self = this;
        self.request_date = new Date();

        self.headers = self.settings.headers;
        self.headers['host'] = self.settings.auth.bucket + ".s3" + lfeUploader.utils.region_string(self.settings.auth.region) + ".amazonaws.com";

        var date_string = [
            self.settings.auth.date.getUTCFullYear(),
            lfeUploader.utils.zfill(self.settings.auth.date.getUTCMonth() + 1, 2),
            lfeUploader.utils.zfill(self.settings.auth.date.getUTCDate(), 2)
        ].join('');

        self.settings.querystring['X-Amz-Date'] = lfeUploader.utils.uriencode(lfeUploader.utils.iso8601(self.request_date));
        self.settings.querystring["X-Amz-Algorithm"] = "AWS4-HMAC-SHA256";
        self.settings.querystring["X-Amz-Expires"] =  86400;
        self.settings.querystring["X-Amz-Credential"] = lfeUploader.utils.uriencode([
            self.settings.auth.access_key,
            "/" + date_string + "/",
            self.settings.auth.region + "/s3/aws4_request"
        ].join(''));
        self.settings.querystring["X-Amz-SignedHeaders"] = "";

        var header_keys = [];
        for(var key in self.headers) {
            header_keys.push(key);
        }
        header_keys.sort();
        self.settings.querystring["X-Amz-SignedHeaders"] = lfeUploader.utils.uriencode(header_keys.join(';'));

        self.settings.querystring["X-Amz-Signature"] = self.get_authorization_header();

        var url = location.protocol + "//" + self.headers['host'] + "/" + self.settings.key;
        delete self.headers['host'];  // keep this header only for hashing

        var first = true;
        for(var key in self.settings.querystring) {
            if(self.settings.querystring.hasOwnProperty(key)) {
                if(first) {
                    url += "?";
                }
                first = false;
                url += key + "=" + self.settings.querystring[key] + "&";
            }
        }
        url = url.slice(0, -1);  // remove extra ampersand

        var xhr = new XHR({
            url: url,
            method: self.settings.method,
            headers: self.headers,
            body: self.settings.payload,

            load_callback: self.settings.load_callback,
            progress_callback: self.settings.progress_callback,
            state_change_callback: self.settings.state_change_callback,
            error_callback: self.settings.error_callback,
            timeout_callback: self.settings.timeout_callback
        });

        xhr.send();

        if(callback) {
            callback(xhr);
        }
    },
    get_authorization_header: function() {
        if(!this.settings.auth.date) {
            throw "Invalid date given.";
        }

        var header = "";

        var header_keys = lfeUploader.utils.get_sorted_keys(this.headers);

        // signed headers
        var signed_headers = "";
        for(var i=0; i<header_keys.length; i++) {
            signed_headers += header_keys[i].toLowerCase() + ";";
        }
        signed_headers = signed_headers.slice(0, -1);

        var canonical_request = this.get_canonical_request();
        var string_to_sign = this.get_string_to_sign(canonical_request, this.request_date);
        var signature = this.sign_request(string_to_sign);

        return signature;
    },
    get_canonical_request: function() {
        var request = "";

        // verb
        request += this.settings.method.toUpperCase() + "\n";

        // path
        request += "/" + lfeUploader.utils.uriencode(this.settings.key).replace(/%2F/g, "/") + "\n";

        // querystring
        var querystring_keys = lfeUploader.utils.get_sorted_keys(this.settings.querystring);
        var key, value, i;
        for(i=0; i<querystring_keys.length; i++) {
            key = querystring_keys[i];
            value = this.settings.querystring[key];
            request += lfeUploader.utils.uriencode(key) + "=" + value + "&amp;";
        }
        request = request.slice(0, -"&amp;".length) + "\n";  // remove extra ampersand

        // headers
        var header_keys = lfeUploader.utils.get_sorted_keys(this.headers);
        for(i=0; i<header_keys.length; i++) {
            key = header_keys[i];
            value = this.headers[key];
            request += key.toLowerCase() + ":" + value.trim() + "\n";
        }
        request += "\n";

        // signed headers
        for(i=0; i<header_keys.length; i++) {
            request += header_keys[i].toLowerCase() + ";";
        }

        request = request.slice(0, -1) + "\n";
        request += "UNSIGNED-PAYLOAD";

        return request;
    },
    get_string_to_sign: function(canonical_request, time) {
        var to_sign = "";
        to_sign += "AWS4-HMAC-SHA256\n";
        to_sign += lfeUploader.utils.iso8601(time) + "\n";
        to_sign += [
            time.getUTCFullYear(),
            lfeUploader.utils.zfill(time.getUTCMonth() + 1, 2),
            lfeUploader.utils.zfill(time.getUTCDate(), 2),
            "/" + this.settings.auth.region + "/s3/aws4_request\n"
        ].join('');

        to_sign += CryptoJS.SHA256(canonical_request.replace(/&amp;/g, "&")).toString();

        return to_sign;
    },
    sign_request: function(string_to_sign) {
        if(!this.settings.auth.signature) {
            throw "No signature provided.";
        }

        var res = CryptoJS.HmacSHA256(
            string_to_sign,
            CryptoJS.enc.Hex.parse(this.settings.auth.signature)
        ).toString();
        return res;
    }
};