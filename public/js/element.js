/**
 * Created by vaney on 7/4/15.
 */


var addEvent = function (elem, eventType, fn) {
    if (elem.addEventListener) {
        elem.addEventListener(eventType, fn, false);
    } else {
        eventType = eventType == 'DOMContentLoaded' ? 'readystatechange' : eventType;
        elem.attachEvent("on" + eventType, function() {
            // set the this pointer same as addEventListener when fn is called
            return (fn.call(elem, window.event));
        });
    }
};

var removeEvent = function (elem, eventType, handler) {
    if (elem.removeEventListener) {
        elem.removeEventListener (eventType, handler, false);
    }

    if (elem.detachEvent) {
        elem.detachEvent ('on' + eventType, handler);
    }
};

var element = function (htmlElement) {
    var self = this;
    this.el = (function () {
        if (htmlElement === undefined) {
            return document;
        }

        // create element
        if (typeof htmlElement === 'string') {
            var div = document.createElement('div');
            div.innerHTML = htmlElement.trim();
            return div.firstChild;
        }

        return htmlElement;
    }());

    this.find = function (selector) {
        var elements = self.el.querySelectorAll(selector),
            resultElements = [],
            i;

        for (i = 0; i < elements.length; i++) {
            resultElements.push(new element(elements[i]));
        }

        return resultElements;
    };

    this.clone = function () {
        return new element(self.el.cloneNode(true));
    };

    this.parent = function () {
        return new element(self.el.parentNode);
    };

    this.append = function (htmlElement) {
        if (htmlElement.el) {
            self.el.appendChild(htmlElement.el);

        } else {
            self.el.appendChild(htmlElement);
        }

        return self;
    };

    this.html = function (html) {
        if (html === undefined) {
            return self.el.innerHTML;
        }

        self.el.innerHTML = html;

        return self;
    };

    this.remove = function () {
        self.el.parentNode.removeChild(self.el);

        self = null;
    };

    this.val = function (value) {
        if (value === undefined) {
            return self.el.value;
        }

        self.el.value = value;

        return self;
    };

    this.attr = function (attrName, value) {
        if (value === undefined) {
            return self.el.getAttribute(attrName);
        }

        self.el.setAttribute(attrName, value);

        return self;
    };

    this.data = function (dataName, value) {
        if (value === undefined) {
            return self.attr('data-' + dataName);
        }

        return self.attr('data-' + dataName, value);
    };

    this.addClass = function (className) {
        if (self.el.classList) {
            self.el.classList.add(className);
        } else {
            self.el.className += ' ' + className;
        }

        return self;
    };

    this.removeClass = function (className) {
        if (self.el.classList) {
            self.el.classList.remove(className);
        } else {
            self.el.className = self.el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
        }

        return self;
    };

    this.hasClass = function (className) {
        if (self.el.classList) {
            return self.el.classList.contains(className);
        } else {
            return new RegExp('(^| )' + className + '( |$)', 'gi').test(self.el.className);
        }
    };

    this.focus = function () {
        self.el.focus();

        return self;
    };

    this.on = function (eventName, handler) {
        addEvent(self.el, eventName, handler);

        return self;
    };

    this.off = function (eventName, handler) {
        if (!arguments.length) {
            var newElement = self.clone();
            self.parent().el.replaceChild(newElement.el, self.el);
            self = newElement;

            return self;
        }
        removeEvent(self.el, eventName, handler);

        return self;
    };

    return this;
};