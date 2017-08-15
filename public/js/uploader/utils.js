/**
 * Created by vaney on 7/4/15.
 */


var lfeUploader = lfeUploader || {};

lfeUploader.utils = {
    uriencode: function(string) {
        var output = encodeURIComponent(string);
        output = output.replace(/[^A-Za-z0-9_.~\-%]+/g, escape);
        output = output.replace(/;/g, "%3B");

        // AWS percent-encodes some extra non-standard characters in a URI
        output = output.replace(/[*]/g, function(ch) {
            return '%' + ch.charCodeAt(0).toString(16).toUpperCase();
        });

        return output;
    },
    get_sorted_keys: function(obj) {
        var keys = [];
        for(var key in obj) {
            if(obj.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        return keys.sort();
    },
    iso8601: function(date) {
        return [
            date.getUTCFullYear(),
            lfeUploader.utils.zfill(date.getUTCMonth() + 1, 2),
            lfeUploader.utils.zfill(date.getUTCDate(), 2),
            "T",
            lfeUploader.utils.zfill(date.getUTCHours(), 2),
            lfeUploader.utils.zfill(date.getUTCMinutes(), 2),
            lfeUploader.utils.zfill(date.getUTCSeconds(), 2),
            "Z"
        ].join("")
    },
    zfill: function(str, num) {
        return ("00000000000" + str).substr(-num);
    },
    region_string: function(region) {
        // given an AWS region, it either returns an empty string for US-based regions
        // or the region name preceded by a dash for non-US-based regions
        // see this for more details: http://docs.aws.amazon.com/AmazonS3/latest/dev/VirtualHosting.html
        if(region && region.slice(0,2) !== 'us') {
            return '-' + region;
        }
        return '';
    },
    extend_object: function(base, extension) {
        var result = base;
        for(var key in extension) {
            if (extension.hasOwnProperty(key)) {
                result[key] = extension[key];
            }
        }
        return result;
    },
    is_compatible: function () {
        // verify that the browser has the needed HTML5 capabilities
        if(!(File && FileList && Blob)) {
            return false;
        }
        if(navigator.userAgent.indexOf("Firefox") !== -1) {
            try {
                new Blob(["something"]);
            } catch(e) {
                return false;
            }
        }
    },

    bind: function bind(func, context) {
        var bound, args,
            nativeBind = Function.prototype.bind,
            ctor = function(){};

        if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
        if (typeof func !== 'function') throw new TypeError();

        args = slice.call(arguments, 2);

        return bound = function() {
            if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
            ctor.prototype = func.prototype;
            var self = new ctor;
            var result = func.apply(self, args.concat(slice.call(arguments)));
            if (Object(result) === result) return result;
            return self;
        };
    }
};