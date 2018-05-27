var Promise = require('../lib/promise');
var promisesAplusTests = require("promises-aplus-tests");

var adapter = {
    resolved: Promise.resolve,
    rejected: Promise.reject,
    deferred: function () {
        var resolve, reject;
        var promise = new Promise(function () {
            resolve = arguments[0];
            reject = arguments[1];
        });
        return {
            promise: promise,
            resolve: resolve,
            reject: reject
        };
    }
};

describe("Promises/A+ Tests", function () {
    promisesAplusTests.mocha(adapter);
});