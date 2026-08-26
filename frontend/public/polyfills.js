/*
 * polyfills.js — Kompatibilitas WebView lama (Android 7 / API 24, WebView Chrome ~51-57)
 *
 * React 19 + dependensi modern memakai API JS yang TIDAK ada di WebView lama
 * (mis. globalThis, Object.hasOwn, structuredClone, AbortController, ResizeObserver,
 * Promise.prototype.finally, Array.prototype.flat, Object.fromEntries,
 * String.prototype.matchAll, String.prototype.padStart, Proxy.revocable, queueMicrotask).
 * Di Android 7 tanpa polyfill ini app blank/white screen (crash di module-load).
 *
 * File ini sengaja ditulis ES5 (tanpa arrow/let/const) supaya bisa di-parse
 * oleh WebView paling tua sekalipun, dan di-load SEBELUM bundle utama (lihat index.html).
 * Semua polyfill memakai feature-detection — di browser modern tidak mengubah apa pun.
 */
(function () {
  "use strict";

  // ---------- globalThis (Chrome 71+) ----------
  // Kritis: bundle Redux/immer memanggil `globalThis.Iterator` saat module-load.
  if (typeof globalThis === "undefined") {
    (function () {
      var g = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : this;
      try {
        Object.defineProperty(g, "globalThis", { value: g, writable: true, configurable: true });
      } catch (e) {
        g.globalThis = g;
      }
    })();
  }

  // ---------- Object.hasOwn (Chrome 93+) ----------
  if (!Object.hasOwn) {
    Object.hasOwn = function (obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    };
  }

  // ---------- Object.fromEntries (Chrome 73+) ----------
  if (!Object.fromEntries) {
    Object.fromEntries = function (entries) {
      var obj = {};
      if (!entries) return obj;
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        obj[entry[0]] = entry[1];
      }
      return obj;
    };
  }

  // ---------- Object.entries / Object.values (Chrome 54+) ----------
  if (!Object.entries) {
    Object.entries = function (obj) {
      var keys = Object.keys(obj);
      var result = [];
      for (var i = 0; i < keys.length; i++) {
        result.push([keys[i], obj[keys[i]]]);
      }
      return result;
    };
  }
  if (!Object.values) {
    Object.values = function (obj) {
      var keys = Object.keys(obj);
      var result = [];
      for (var i = 0; i < keys.length; i++) {
        result.push(obj[keys[i]]);
      }
      return result;
    };
  }

  // ---------- Array.prototype.includes (Chrome 47+, aman; ditambah utk jaga-jaga) ----------
  if (!Array.prototype.includes) {
    Array.prototype.includes = function (search, fromIndex) {
      if (this == null) throw new TypeError("Array.prototype.includes called on null or undefined");
      var O = Object(this);
      var len = O.length >>> 0;
      if (len === 0) return false;
      var n = fromIndex | 0;
      var k = Math.max(n >= 0 ? n : len + n, 0);
      function sameValueZero(x, y) {
        return x === y || (typeof x === "number" && typeof y === "number" && isNaN(x) && isNaN(y));
      }
      while (k < len) {
        if (sameValueZero(O[k], search)) return true;
        k++;
      }
      return false;
    };
  }

  // ---------- Array.prototype.flat / flatMap (Chrome 69+) ----------
  if (!Array.prototype.flat) {
    Array.prototype.flat = function (depth) {
      var d = typeof depth === "number" ? depth : 1;
      var result = [];
      function flatten(arr, remaining) {
        for (var i = 0; i < arr.length; i++) {
          if (Array.isArray(arr[i]) && remaining > 0) {
            flatten(arr[i], remaining - 1);
          } else {
            result.push(arr[i]);
          }
        }
      }
      flatten(this, d);
      return result;
    };
  }
  if (!Array.prototype.flatMap) {
    Array.prototype.flatMap = function (callback, thisArg) {
      var self = this;
      var result = [];
      for (var i = 0; i < self.length; i++) {
        var mapped = callback.call(thisArg, self[i], i, self);
        if (Array.isArray(mapped)) {
          result = result.concat(mapped);
        } else {
          result.push(mapped);
        }
      }
      return result;
    };
  }

  // ---------- String.prototype.matchAll (Chrome 73+) ----------
  if (!String.prototype.matchAll) {
    String.prototype.matchAll = function (regexp) {
      var str = String(this);
      var flags = regexp instanceof RegExp ? regexp.flags || "" : "";
      if (flags.indexOf("g") === -1) flags += "g";
      var source = regexp instanceof RegExp ? regexp.source : String(regexp);
      var rx = new RegExp(source, flags);
      var matches = [];
      var m;
      while ((m = rx.exec(str)) !== null) {
        matches.push(m);
        if (m.index === rx.lastIndex) rx.lastIndex++;
      }
      var idx = 0;
      return {
        next: function () {
          if (idx < matches.length) return { value: matches[idx++], done: false };
          return { value: undefined, done: true };
        },
        [Symbol.iterator]: function () {
          return this;
        }
      };
    };
  }

  // ---------- String.prototype.padStart / padEnd (Chrome 57+) ----------
  if (!String.prototype.padStart) {
    String.prototype.padStart = function (targetLength, padString) {
      var str = String(this);
      var t = targetLength >> 0;
      var pad = padString === undefined ? " " : String(padString);
      if (str.length >= t || pad.length === 0) return str;
      var needed = t - str.length;
      var full = "";
      while (full.length < needed) full += pad;
      return full.slice(0, needed) + str;
    };
  }
  if (!String.prototype.padEnd) {
    String.prototype.padEnd = function (targetLength, padString) {
      var str = String(this);
      var t = targetLength >> 0;
      var pad = padString === undefined ? " " : String(padString);
      if (str.length >= t || pad.length === 0) return str;
      var needed = t - str.length;
      var full = "";
      while (full.length < needed) full += pad;
      return str + full.slice(0, needed);
    };
  }

  // ---------- Promise.prototype.finally (Chrome 63+) ----------
  if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
    Promise.prototype.finally = function (onFinally) {
      var C = this.constructor || Promise;
      return this.then(
        function (value) {
          return C.resolve(typeof onFinally === "function" ? onFinally() : onFinally).then(function () {
            return value;
          });
        },
        function (reason) {
          return C.resolve(typeof onFinally === "function" ? onFinally() : onFinally).then(function () {
            throw reason;
          });
        }
      );
    };
  }

  // ---------- queueMicrotask (Chrome 71+) ----------
  if (typeof queueMicrotask === "undefined") {
    var g3 = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : globalThis;
    g3.queueMicrotask = function (fn) {
      Promise.resolve().then(fn);
    };
  }

  // ---------- AbortController / AbortSignal (Chrome 66+) ----------
  // Implementasi minimal yang cukup untuk axios/react-query/fetch.
  if (typeof AbortController === "undefined") {
    function AbortSignalPolyfill() {
      this.aborted = false;
      this.onabort = null;
      this._listeners = [];
    }
    AbortSignalPolyfill.prototype.addEventListener = function (type, fn) {
      if (type === "abort") this._listeners.push(fn);
    };
    AbortSignalPolyfill.prototype.removeEventListener = function (type, fn) {
      if (type === "abort") {
        var i = this._listeners.indexOf(fn);
        if (i !== -1) this._listeners.splice(i, 1);
      }
    };
    AbortSignalPolyfill.prototype.dispatchEvent = function () {
      return true;
    };

    function AbortControllerPolyfill() {
      this.signal = new AbortSignalPolyfill();
      var self = this;
      this.abort = function (reason) {
        var s = self.signal;
        if (s.aborted) return;
        s.aborted = true;
        s.reason = reason;
        var listeners = s._listeners.slice();
        for (var i = 0; i < listeners.length; i++) {
          try {
            listeners[i].call(s, { type: "abort", target: s });
          } catch (e) {}
        }
        if (typeof s.onabort === "function") {
          try {
            s.onabort.call(s, { type: "abort", target: s });
          } catch (e) {}
        }
      };
    }

    var g = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : this;
    g.AbortController = AbortControllerPolyfill;
    g.AbortSignal = AbortSignalPolyfill;
  }

  // ---------- ResizeObserver (Chrome 64+) ----------
  // Polyfill minimal: langsung panggil callback dgn ukuran saat ini + ikuti window resize.
  if (typeof ResizeObserver === "undefined") {
    function ResizeObserverPolyfill(callback) {
      this._callback = callback;
      this._targets = [];
      var self = this;
      function fireAll() {
        for (var i = 0; i < self._targets.length; i++) {
          var el = self._targets[i];
          var rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
          if (!rect) continue;
          var entry = {
            target: el,
            contentRect: {
              x: rect.left, y: rect.top, width: rect.width, height: rect.height,
              top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left
            }
          };
          try {
            self._callback([entry], self);
          } catch (e) {}
        }
      }
      this._fire = fireAll;
      if (typeof window !== "undefined" && !ResizeObserverPolyfill._bound) {
        ResizeObserverPolyfill._bound = true;
        window.addEventListener("resize", fireAll);
      }
    }
    ResizeObserverPolyfill.prototype.observe = function (target) {
      if (this._targets.indexOf(target) === -1) this._targets.push(target);
      var self = this;
      // panggil sekali dgn ukuran awal supaya komponen (framer-motion/radix) tidak hang
      setTimeout(function () { self._fire(); }, 0);
    };
    ResizeObserverPolyfill.prototype.unobserve = function (target) {
      var i = this._targets.indexOf(target);
      if (i !== -1) this._targets.splice(i, 1);
    };
    ResizeObserverPolyfill.prototype.disconnect = function () {
      this._targets = [];
    };

    var g2 = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : this;
    g2.ResizeObserver = ResizeObserverPolyfill;
  }

  // ---------- structuredClone (Chrome 98+) ----------
  if (typeof structuredClone === "undefined") {
    var g4 = typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : globalThis;
    g4.structuredClone = function (value) {
      // fallback JSON — cukup utk path error-serialization di bundle
      return JSON.parse(JSON.stringify(value));
    };
  }

  // ---------- Proxy.revocable (Chrome 63+) ----------
  // Bundle (react-query) memakai Proxy.revocable; fallback tanpa revoke sungguhan.
  if (typeof Proxy !== "undefined" && typeof Proxy.revocable === "undefined") {
    Proxy.revocable = function (target, handler) {
      return { proxy: new Proxy(target, handler), revoke: function () {} };
    };
  }
})();
