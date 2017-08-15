/**
 * Created by vaney on 7/4/15.
 */


var XHR = function (args) {
    // the user may or may not pass any headers
    this.headers = args.headers || {};

    // if no method is given, default to GET
    this.method = args.method || "GET";

    this.body = args.body || null;

    this.request = new XMLHttpRequest();

    // set the "load" callback if given
    if (args.load_callback && typeof args.load_callback == 'function') {
        this.request.addEventListener("load", args.load_callback, true);
    }

    // set the "error" callback if given
    if (args.error_callback && typeof args.error_callback == 'function') {
        this.request.addEventListener("error", args.error_callback, true);
    }

    // set the "readystatechange" callback if given
    if (args.state_change_callback && typeof args.state_change_callback == 'function') {
        this.request.addEventListener("readystatechange", args.state_change_callback);
    }

    // set the "progress" callback if given
    if (args.progress_callback && typeof args.progress_callback == 'function') {
        this.request.upload.addEventListener("progress", args.progress_callback);
    }

    // set the "timeout" callback if given
    if (args.timeout_callback && typeof args.timeout_callback == 'function') {
        this.request.addEventListener('timeout', args.timeout_callback);
    }

    // adding extra params as needed
    this.url = args.url;

    if (args.extra_params) {
        for (var param_name in args.extra_params) {
            if (args.extra_params.hasOwnProperty(param_name)) {
                if (this.url.indexOf('?') !== -1) {
                    this.url += "&";
                } else {
                    this.url += "?";
                }

                this.url += encodeURIComponent(param_name) + "=";
                this.url += encodeURIComponent(args.extra_params[param_name]);
            }
        }
    }
};

XHR.prototype.send = function () {
    if (!this.request) {
        throw new Error('No object was instantiated. Please use "new" operator.');
    }

    this.request.open(this.method, this.url);

    // set the headers
    for (var header in this.headers) {
        if (this.headers.hasOwnProperty(header)) {
            this.request.setRequestHeader(header, this.headers[header]);
        }
    }

    // send the ajax call
    if (this.body) {
        this.request.send(this.body);
    } else {
        this.request.send();
    }

    return this;
};