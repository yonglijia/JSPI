function Promise(executor) {

    let _this = this

    _this.status = 'pending'
    _this.value = null
    _this.reason = null
    _this.onFulfilledCallbacks=[]
    _this.onRejectedCallbacks=[]


    function resolve(value) {
        if(_this.status === 'pending'){
            _this.status = 'fulfilled'
            _this.value = value
            _this.onFulfilledCallbacks.forEach(function(fn){
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

    executor(function (value) {
        resolve(value)
    }, function (reason) {
        reject(reason)
    })
}

Promise.prototype.then = function (onFulfilled, onRejected) {

    let _this = this
    let newPromise
    if (_this.status == 'fulfilled') {
        // //add
        newPromise = new Promise(function(resolve,reject){
            let x = onFulfilled(_this.value)
            resolve(x)
        })
    }

    if (_this.status == 'rejected') {//不论 promise1 被 reject 还是被 resolve 时 newPromise 都会被 resolve，只有出现异常时才会被 rejected
        //add
        newPromise = new Promise(function(resolve,reject){
            let x = onRejected(_this.reason)
            resolve(x) //为什么rejected了还resolve呢?

        })
    }

    if (_this.status == 'pending'){
        //add
        newPromise = new Promise(function(resolve,reject){
            _this.onFulfilledCallbacks.push(function(){
                let x = onFulfilled(_this.value)
                resolve(x)
            })

            _this.onRejectedCallbacks.push(function(){
                let x = onRejected(_this.reason)
                resolve(x)
            })
        })
    }
    return newPromise
};


//-------------test code--------------
(function(type){

    return [()=>{},()=>{
        //-------------------normal
        let promise1 = new Promise((resolve,reject) => {
            resolve('test simplePromise resolve')
        })

        promise1.then(function(value){
            console.log('success:',value)
            return 'success next'
        },function(reason){
            console.log('failed:',reason)
        }).then(function(value){
            console.log('success:',value)
        },function(reason){
            console.log('failed:',reason)
        })
    },()=>{
        //-------------------normal reject
        let promise2 = new Promise((resolve,reject) => {
            reject('test simplePromise reject')
        })

        promise2.then(function(value){
            console.log('success:',value)
        },function(reason){
            console.log('failed:',reason)
            return 'failed next'
        }).then(function(value){
            console.log('success:',value)
        },function(reason){
            console.log('failed:',reason)
        })
    },()=>{
        //Q-----------------can't catch error
        let promise3 = new Promise((resolve,reject) => {
            throw new Error('error')
        })
        promise3.then((value)=>{
            console.log('success:',value)
        },(reason)=>{
            console.log('reject:',reason)
        })
    }][type]
})(3)()





