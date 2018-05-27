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
        //--------normal
        new Promise((resolve,reject)=>{
            resolve(1)
        }).then().then().then((value)=>{
            console.log(value)
        },(reason)=>{console.log(reason)})
    },()=>{

        //2 Unhandle situation when sync call onFulfill and onReject

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

        // var promise2 = new Promise((resolve,reject) => {
        //     resolve('test simplePromise resolve')
        // })
        //
        // promise2.then(function(value){
        //     console.log('success:',value)
        // },function(reason){
        //     console.log('failed:',reason)
        // })

        // console.log('end')
        //5.2

    }][type]
})(2)()

module.exports = Promise