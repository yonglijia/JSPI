var asyncCall = (process && process.nextTick) || setImmediate || function (callback) {
    if (typeof callback !== 'function')
        throw new TypeError('callback is not a function');
    var Mutation = window.MutationObserver || window.WebKitMutationObserver;
    var observer = new Mutation(callback);
    var element = document.createTextNode('');
    observer.observe(element, {
        characterData: true
    });
    element.data = 1;
} || function (callback) {
    if (typeof callback !== 'function')
        throw new TypeError('callback is not a function');
    setTimeout(callback, 0);
};

function Promise(executor) {
    if (!(this instanceof Promise)) {
        return new Promise(executor);
    }

    if (typeof executor !== 'function') {
        throw new TypeError('Promise executor is not a function');
    }

    let _this = this
    _this.status = 'pending'
    _this.value = null
    _this.reason = null
    _this.onRejectedCallbacks = []
    _this.onResolvedCallbacks = []

    function resolve(value) {
        resolvePromise(_this,value,fulfill,reject)
    }

    function fulfill(value){ //只接收普通值
        if (_this.status === 'pending') {
            _this.status = 'resolved'
            _this.value = value
            _this.onResolvedCallbacks.forEach(function (fn) {
                fn()
            })
        }
    }

    function reject(reason) {
        if (_this.status === 'pending') {
            _this.status = 'rejected'
            _this.reason = reason
            _this.onRejectedCallbacks.forEach(function (fn) {
                fn()
            })
        }
    }


    try {
        let called = false
        executor(function (value) {
            if(called) return
            called = true
            resolve(value)
        }, function (reason) {
            if(called) return
            called = true
            reject(reason)
        })
    } catch (e) {
        reject(e)
    }

}

function resolvePromise(promise,x,fulfill,reject) {

    if (promise === x) {//2.3.1 传进来的x与当前promise相同，报错
        return reject(new TypeError('循环引用了'))
    }

    //2.3.2 x如果是一个promise
    if (x instanceof Promise) {
        //2.3.2.1
        if (x.status === 'pending') { //x状态还未改变，返回的下一个promise的resove的接收的值y不确定，对其递归处理
            x.then(function(y) {
                resolvePromise(promise, y, fulfill, reject)
            },reject)
        } else {
            //2.3.2.2 ,  2.3.2.3
            //状态确定，如果fulfill那传进来的肯定是普通值，如果reject直接处理，不管你抛出来的是什么东东
            x.then(fulfill, reject)
        }
        return;
    }
    let called = false;
    //2.3.3
    //x 是一个thenable
    if(x !== null && (typeof x === 'object' || typeof x === 'function')){
        try {
            //2.3.3.1
            let then = x.then;
            if (typeof then === 'function') {//2.3.3.3  {then:: (resolve,reject)=>{resolve(1)}}}
                then.call(x,(y)=>{
                    if (called) return
                    called = true
                    resolvePromise(promise,y,fulfill,reject)
                },(err)=>{
                    if (called) return
                    called = true
                    reject(err)
                })
            }else{//2.3.3.2   x: {then:1}，是一个带then属性的普通值
                fulfill(x)
            }
        }catch(e){//2.3.3.2  可以参见上面说的异常情况2
            if (called) return
            called = true;
            reject(e);
        }
    }else{//2.3.3.4,x是一个普通值
        fulfill(x)
    }
}

Promise.prototype.then = function (onFulfilled, onRejected) {

    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : function (value) {
        return value
    }
    onRejected = typeof onRejected === 'function' ? onRejected : function (err) {
        throw err
    }

    let _this = this
    let newPromise
    if (_this.status === 'resolved') {
        newPromise = new Promise(function (resolve, reject) {
            asyncCall(function () {
                try {
                    let x = onFulfilled(_this.value)
                    resolve(x)
                } catch (e) {
                    console.log(e)
                    reject(e)
                }
            })
        })
    }

    if (_this.status === 'rejected') {
        newPromise = new Promise(function (resolve, reject) {
            asyncCall(function () {
                try {
                    let x = onRejected(_this.reason)
                    resolve(x)
                } catch (e) {
                    reject(e)
                }
            })
        })
    }

    if (_this.status === 'pending') {
        newPromise = new Promise(function (resolve, reject) {

            _this.onResolvedCallbacks.push(function () {
                asyncCall(function () {
                    try {
                        let x = onFulfilled(_this.value)
                        resolve(x)
                    } catch (e) {
                        reject(e)
                    }
                })

            })


            _this.onRejectedCallbacks.push(function () {
                asyncCall(function () {
                    try {
                        let x = onRejected(_this.reason)
                        resolve(x)
                    } catch (e) {
                        reject(e)
                    }
                })
            })

        })
    }
    return newPromise
}

Promise.prototype.catch = function(callback){
    return this.then(null,callback)
}
Promise.resolve = function(value){
    return new Promise(function(resolve,reject){
        resolve(value);
    })
}
Promise.reject = function(value){
    return new Promise(function(resolve,reject){
        reject(value);
    })
}
Promise.race = function(promise){
    return new Promise(function (resolve,reject){
        for(var i = 0;i<promise.length;i++){
            promise[i].then(resolve,reject)
        }
    })
}
Promise.all = function(promises){
    return new Promise(function(resolve,reject){
        let resultArr = [];
        let times = 0;
        function processData(index,y){
            resultArr[index]= y;
            if(++times === promises.length){
                resolve(resultArr)
            }
        }
        for(var i = 0;i<promises.length;i++){
            promises[i].then(function(y){
                processData(i,y)
            },reject)
        }
    })
}

Promise.deferred = Promise.defer = function () {
    var dfd = {}
    dfd.promise = new Promise(function (resolve, reject) {
        dfd.resolve = resolve
        dfd.reject = reject
    })
    return dfd
}
module.exports = Promise