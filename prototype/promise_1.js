function Promise(executor) {

    let _this = this
    _this.status = 'pending'
    _this.value = null
    _this.reason = null

    function resolve(value) {
        if (_this.status === 'pending') {
            _this.status = 'fulfilled'
            _this.value = value
        }
    }

    function reject(reason) {
        if (_this.status === 'pending') {
            _this.status = 'rejected'
            _this.reason = reason
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
};


(function (type) {
    return [() => {
    }, () => {
        //-------------------normal
        var promise1 = new Promise((resolve, reject) => {
            resolve('test simplePromise resolve')
            //reject('test simplePromise reject')
        })

        promise1.then(function (value) {
            console.log('success:', value)
        }, function (reason) {
            console.log('failed:', reason)
        })

    }, () => {
        //Q-------------------without Async
        var promise2 = new Promise((resolve, reject) => {
            setTimeout(function () {
                resolve('test simplePromise resolve')
            }, 100)
        })
        promise2.then(function (value) {
            console.log('success:', value)
        }, function (reason) {
            console.log('failed:', reason)
        })

    }, () => {
        //Q-------------------without Chain
        var promise3 = new Promise((resolve, reject) => {
            resolve('test simplePromise resolve')
        })
        promise3.then(function (value) {
            console.log('success:', value)
        }, function (reason) {
            console.log('failed:', reason)
        }).then(function (value) {
            console.log('success:', value)
        }, function (reason) {
            console.log('failed:', reason)
        })
    }][type]
})(1)()





