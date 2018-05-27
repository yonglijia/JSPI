function Promise(executor) {
    //add ----
    if (!(this instanceof Promise)) {
        return new Promise(executor);
    }

    //add
    if (typeof executor !== 'function') {
        throw new TypeError('Promise executor is not a function');
    }

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
    //add
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

    let _this = this
    let newPromise
    if (_this.status == 'fulfilled') {
        newPromise = new Promise(function(resolve,reject){
            //add
            try{
                let x = onFulfilled(_this.value)
                resolve(x)
            }catch(e){
                reject(e)
            }

        })
    }

    if (_this.status == 'rejected') {
        newPromise = new Promise(function(resolve,reject){
            //add
            try{
                let x = onRejected(_this.reason)
                resolve(x)
            }catch(e){
                reject(e)
            }

        })
    }

    if (_this.status == 'pending'){
        newPromise = new Promise(function(resolve,reject){

            _this.onFulfilledCallbacks.push(function(){
                //add
                try{
                    let x = onFulfilled(_this.value)
                    resolve(x)
                }catch(e){
                    reject(e)
                }
            })

            _this.onRejectedCallbacks.push(function(){
                //add
                try{
                    let x = onRejected(_this.reason)
                    resolve(x)
                }catch(e){
                    reject(e)
                }
            })

        })
    }
    return newPromise
};

//-------------test code--------------
(function(type){

    return [()=>{
    },()=>{
        //----------normal catch error
        let promise1 = new Promise((resolve,reject) => {
            throw new Error('error')
        })
        promise1.then((value)=>{
            console.log('success:',value)
        },(reason)=>{
            console.log('reject:',reason)
        })
    },()=>{
        //2can't transmit value
        new Promise((resolve,reject)=>{
            resolve(1)
        }).then().then().then((value)=>{
            console.log(value)
        },(reason)=>{console.log(reason)})
    }][type]
})(``)()

module.exports = Promise