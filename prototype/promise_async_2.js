function Promise(executor) {

    let _this = this
    _this.status = 'pending'
    _this.value = null
    _this.reason = null

    //-----------add--------------
    _this.onFulfilledCallbacks=[]
    _this.onRejectedCallbacks=[]

    function resolve(value) {
        if (_this.status === 'pending') {
            _this.status = 'fulfilled'
            _this.value = value
            //-----------add--------------
            _this.onFulfilledCallbacks.forEach(function (fn) {
                fn()
            })

        }
    }

    function reject(reason) {
        if (_this.status === 'pending') {
            _this.status = 'rejected'
            _this.reason = reason

            //-----------add--------------
            _this.onRejectedCallbacks.forEach(function (fn) {
                fn()
            })
        }
    }

    executor(function (value) {
        resolve(value)
    }, function (reason) {
        reject(reason)
    })
}

Promise.prototype.then = function (onFulfilled, onRejected) {

    let _this = this

    if (_this.status == 'fulfilled') {
        onFulfilled(_this.value)
    }

    if (_this.status == 'rejected') {
        onRejected(_this.reason)
    }

    //-----------add------------
    if (_this.status == 'pending') {

        _this.onFulfilledCallbacks.push(function () {
            onFulfilled(_this.value)
        })
        _this.onRejectedCallbacks.push(function () {
            onRejected(_this.reason)
        })
    }
};

//-------------test code--------------

(function (type) {
    return [() => {
    }, () => {

        var promise1 = new Promise((resolve, reject) => {
            setTimeout(function () {
                //resolve('test simplePromise resolve')
                reject('test simplePromise reject')
            }, 1000)
        })

        promise1.then(function (value) {
            console.log('success:', value)
        }, function (reason) {
            console.log('failed:', reason)
        })

    }][type]
})(1)()

