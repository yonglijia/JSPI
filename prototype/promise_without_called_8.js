
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
        executor(function (value) {
            resolve(value)
        }, function (reason) {
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
    //2.3.2
    if (x instanceof Promise) {
        //2.3.2.1
        if (x.status === 'pending') { //x状态还未改变，返回的下一个promise的resove的接收的值y不确定，对其递归处理
            x.then(function(y) {
                resolvePromise(promise, y, fulfill, reject)
            }, reject)
        } else {
            //2.3.2.2     2.3.2.3
            //状态确定，如果fulfill那传进来的肯定是普通值，如果reject直接处理，不管你抛出来的是什么东东
            x.then(fulfill, reject)
        }
        return
    }
    fulfill(x)
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
            process.nextTick(function () {
                try {
                    let x = onFulfilled(_this.value)
                    resolve(x)
                } catch (e) {
                    reject(e)
                }
            })
        })
    }

    if (_this.status === 'rejected') {
        newPromise = new Promise(function (resolve, reject) {
            process.nextTick(function () {
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
                process.nextTick(function () {
                    try {
                        let x = onFulfilled(_this.value)
                        resolve(x)
                    } catch (e) {
                        reject(e)
                    }
                })

            })


            _this.onRejectedCallbacks.push(function () {
                process.nextTick(function () {
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
};

//-------------test code--------------
(function (type) {

    return [() => {}, ()=>{
        //--------------- normal
        new Promise((resolve, reject) => {
            resolve(new Promise((resolve) => {
                resolve(1)
            }))
        }).then((value) => {
            console.log('success1:', value)
        }, (reason) => {
            console.log('failed1:', reason)
        })

    }, ()=>{

        //Q--------------withoutcalled
        new Promise((resolve, reject) => {
            resolve(new Promise((resolve) => {
                resolve(1)
            }))
            reject('error')
        }).then((value) => {
            console.log('success:', value)
        }, (reason) => {
            console.log('failed:', reason)
        })

    },][type]

}(1)())


module.exports = Promise