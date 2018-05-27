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
    _this.onRejectedCallbacks=[]
    _this.onResolvedCallbacks=[]

    function resolve(value) {
        if(_this.status === 'pending'){
            _this.status = 'resolved'
            _this.value = value
            _this.onResolvedCallbacks.forEach(function(fn){
                fn()
            })
        }
    }

    function reject(reason) {
        if(_this.status === 'pending'){
            _this.status = 'rejected'
            _this.reason = reason
            _this.onRejectedCallbacks.forEach(function(fn){
                fn()
            })
        }
    }
    try{
        executor(function (value) {
            resolve(value)
        }, function (reason) {
            reject(reason)
        })
    }catch(e){
        reject(e)
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
    if (_this.status == 'resolved') {

        newPromise = new Promise(function(resolve,reject){
            //add
            setTimeout(function () {
                try{
                    let x = onFulfilled(_this.value)
                    resolve(x)
                }catch(e){
                    reject(e)
                }
            })

        })
    }

    if (_this.status == 'rejected') {
        newPromise = new Promise(function(resolve,reject){
            //add
            setTimeout(function () {
                try{
                    let x = onRejected(_this.reason)
                    resolve(x)
                }catch(e){
                    reject(e)
                }
            })

        })
    }

    if (_this.status == 'pending'){
        newPromise = new Promise(function(resolve,reject){
            //add
            _this.onResolvedCallbacks.push(function(){
                setTimeout(function () {
                    try {
                        let x = onFulfilled(_this.value)
                        resolve(x)
                    } catch (e) {
                        reject(e)
                    }
                })
            })
            //add
            _this.onRejectedCallbacks.push(function(){
                setTimeout(function () {
                    try {
                        let x = onFulfilled(_this.value)
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

    return [() => {
    },()=>{
        //-----------normal
        var promise2 = new Promise((resolve,reject) => {
            setTimeout(function(){
                resolve('test simplePromise resolve')
            },100)
        })

        setTimeout(() => {
            promise2.then(function(value){
                console.log('success:',value)
            },function(reason){
                console.log('failed:',reason)
            })

            console.log('end')
        }, 200);
    }, () => {
        //Q-----------------setTimeout problem
        setTimeout(() => {
            console.log(5)
        })
        new Promise(resolve => {
            console.log(1);
            resolve(3);
            new Promise((resolve) => {
                resolve()
            }).then(() => console.log(4))
        }).then(num => {
            console.log(num)
        });

        console.log(2)
        //6.2 testPromise
    }][type]

}(2)())

module.exports = Promise