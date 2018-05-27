# JSPI
Just a simple Promise/A+ implementation

声明：本篇文章不是讲Promise如何使用的。如果还不清楚，请移步：http://es6.ruanyifeng.com/#docs/promise，阮一峰老师讲的通俗易懂！

用过很久Promise，大家应该都很熟悉了吧！既然那么熟了，下面几个问题，了解一下？

```javascript
Promise.resolve(1).then(2).then(new Promise()).then(console.log)
```

```javascript
Promise.resolve(new Error('error')).then((value)=>{
    console.log('then:',value)
}).catch((error)=>{
    console.log('catch:',error)
})
```

```javascript
new Promise((resolve, reject) => {
    resolve({
        then:(onFulfilled,onRejected)=>{
            onFulfilled(new Promise((resolve1)=>{
                setTimeout(()=>{
                    resolve1(456)
                },1000)
            }))
            onRejected(789)
        }
    })
}).then((value) => {
    console.log('fulfilled:', value)
}, (reason) => {
    console.log('rejected:', reason)
})
```

以上每个问题的答案是什么？为什么？是不是有点懵逼？你还敢说你熟悉吗？（如果你很清楚，那恭喜你，下面的你不用看了，这里已经不适合你了）

要正确解释上面的问题，你需要充分的理解JS的运行机制以及Promise的实现原理。本文的目的就是为了让你理解透彻Promise到底是什么东西。

下面，我们从一个Promise雏形开始，通过打补丁的方式，一步一步实现一个完整的Promise。Promise的原理，顺其自然就明白了！

## PromiseA+规范

首先来看下规范，https://promisesaplus.com。是不是顿时又懵逼了，这么长，这都是啥和啥啊。。。

别怕，我简单总结了下它的核心点，也就四个：

1.Promise是一个状态机，有三种状态pending，fulfilled，rejected。只能从pending状态，转换为fulfilled或者rejected，不可逆转且无第三种状态转换方式。

2.必须提供一个then方法用以处理当前值：终值和据因。then接收两个参数onFufilled，onRejected分别处理fulfilled和reject状态。

3.then方法必须返回一个promise , 便于链式调用。

4.then方法返回的promise中的必须包含一个resolve方法，能够处理上一个promise的onFulfilled/onRejected返回的各种类型的值x和直接传入的各种类型的值；也就是说，它的resove方法，能够接受各种类型的数据，并最终接受一个普通值。

## Promise雏形

先来实现一个promise的雏形：

```javascript
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
    //暂时不要问为什么写那么啰嗦，山人自有妙计，文末分解
    executor(function (value) {
        resolve(value)
    }, function (reason) {
        reject(reason)
    },)
}

Promise.prototype.then = function (onFulfilled, onRejected) {
    let _this = this
    
    if (_this.status == 'fulfilled') {
        onFulfilled(_this.value)
    }

    if (_this.status == 'rejected') {
        onRejected(_this.reason)
    }
}
```

从上面的代码中，promise里面的东西是很健全的，有改变promise装态的两个方法resolve(确切的说，这个方法应该叫fulfill，fulfill和resolve是概念是不一样的，后面会解释原因)和reject(这个也是不严谨的，后面会解释)，有管理状态的status，保存fulfilled状态值的value和rejected拒因的reason，还包含了一个then方法用来处理fulfilled的值和rejected的据因（还有一行`小注释`）。

来试验一下:

```javascript
var promise = new Promise((resolve, reject) => {
    resolve('test simplePromise resolve')
})

promise1.then(function (value) {
    console.log('success:', value)
}, function (reason) {
    console.log('failed:', reason)
})
```

妥妥的`success:test simplePromise resolve`

来个问题测试一下，`Q1`

```javascript
var promise = new Promise((resolve, reject) => {
    setTimeout(function () {
        resolve('test simplePromise resolve')
    }, 100)
})
promise.then(function (value) {
    console.log('success:', value)
}, function (reason) {
    console.log('failed:', reason)
})
```

你会发现，结果呢，怎么什么反应都没有。。。

从这里可以看出，它还不能处理异步的情况。不能处理异步，那叫什么Promise。

那怎么实现异步呢？要支持异步，then方法里面的参数就不能立即执行。既然不能立即执行，那就找地方，先保存起来呗！

### 异步调用

```javascript
_this.onFulfilledCallbacks = []
_this.onResolvedCallbacks = []
```

弄两个数组，在then方法中添加

```javascript
if (_this.status == 'pending') {
    _this.onFulfilledCallbacks.push(function () {
        onFulfilled(_this.value)
    })
    _this.onRejectedCallbacks.push(function () {
        onRejected(_this.reason)
    })
}
```

在resolve和reject中调用

```javascript
function resolve(value) {
    if (_this.status === 'pending') {
        _this.status = 'fulfilled'
        _this.value = value
        _this.onFulfilledCallbacks.forEach(function (fn) {
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
```

好了，这样就实现了异步调用。

来继续下一个话题，`Q2`

```javascript
var promise = new Promise((resolve, reject) => {
    resolve('test simplePromise fulfilled')
})
promise.then(function (value) {
    console.log('success:', value)
}, function (reason) {
    console.log('failed:', reason)
}).then(function (value) {
    console.log('success:', value)
}, function (reason) {
    console.log('failed:', reason)
})
```

结果是：`TypeError: Cannot read property 'then' of undefined`，说好的链式调用呢。。。

### 链式调用

实现链式调用，首先想到就是then方法返回this。返回this有什么问题呢，你经过第一个then方法之后，你的状态改变了，那你继续使用this.then，Promise转态改变一次就不能更改了，所以它传入的参数都无法执行，后面跟再多的then都不会执行，这显然不行。所以我们只有通过返回一个新的promise，为啥呢，promise有then方法啊！！！

继续打补丁，对then方法进行改造。

```javascript
let newPromise
if (_this.status == 'fulfilled') {
    newPromise = new Promise(function(resolve,reject){
        let x = onFulfilled(_this.value)
        resolve(x)
    })
}

if (_this.status == 'rejected') {
    newPromise = new Promise(function(resolve,reject){
        let x = onRejected(_this.reason)
        resolve(x) 
    })
}

if (_this.status == 'pending'){
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
```

> 这里有个地方需要解释下：newPromise的状态不能因为上一个promise被reject了，而更改newPromise的状态；也就是说上一个promise无论被 reject 还是被 resolve ， newPromise 都会被 resolve，只有出现异常时才会被 rejecte。

`Q2`链式调用的问题也就解决了。那，抛个错误玩玩？看下 `Q3`

```javascript
let promise = new Promise((resolve,reject) => {
    throw new Error('error')
})
promise.then((value)=>{
    console.log('success:',value)
},(reason)=>{
    console.log('reject:',reason)
})
```

结果：Boom！！！`Error: error.....！`还是太年轻，经不起一点挫折啊。。。

### 异常处理

来吧，继续打补丁

```javascript
if (!(this instanceof Promise)) {
    return new Promise(executor);
}

if (typeof executor !== 'function') {
    throw new TypeError('Promise executor is not a function');
}

try{
    executor(resolve, reject)
}catch(e){
    reject(e)
}
```

then方法中

```javascript
if (_this.status == 'fulfilled') {
    newPromise = new Promise(function(resolve,reject){
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
            try{
                let x = onFulfilled(_this.value)
                resolve(x)
            }catch(e){
                reject(e)
            }
        })

        _this.onRejectedCallbacks.push(function(){ //add
            try{
                let x = onRejected(_this.reason)
                resolve(x)
            }catch(e){
                reject(e)
            }
        })

    })
}
```

贴了这么多狗皮膏药，再怎么处理折腾也能扛得住了，比如上面的问题，它很从容的打印一个`reject: Error: error`，并不会崩溃，处理异常就是这么淡定。

> 人生从来都不是一帆风顺的，有一个坑，就会有更多坑！

比如下面的问题跑个试试，`Q4`

```javascript
new Promise((resolve,reject)=>{
    resolve(1)
}).then().then().then((value)=>{
    console.log(value)
},(reason)=>{console.log(reason)})
```

结果:`TypeError: onRejected is not a function`，怎么变成了车祸现场了?按照原生的Promise，不是应该打印`1`吗？`1`哪里去了，毫无疑问，丢了！丢了，那就把它找回来。

### 值穿透

先来解释一下为什么：then里面啥也不传，也就是说，onFulfilled就取不到，下面的代码

```javascript
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
```

中的` let x = onFulfilled(_this.value)`就会报错，会被捕获，然后`reject(e)`，下一个then啥也不传，同样的结果，传到最后一个，被捕获了。

毫无疑问`1`丢了，我们可不可以这样：既然你不传，我们就给你默认一个方法，这样不至于造成车祸现场。我们还想值穿透怎么办？使这个方法啥也不干，就只干一件事，给它啥，它吐出来啥！

在then方法中，添加

```javascript
onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : function (value) {
    return value
}
onRejected = typeof onRejected === 'function' ? onRejected : function (err) {
    throw err
}
```

搞定！

我们解决了不少问题了：`异步调用`，`链式调用` ，`异常处理`，`值穿透`，是不是可以休息会了？当然不行！

> 人生本来就不太平，就是一个接一个的坎！

比如，下面的情况又没办法解决了。。。

`Q5`

```javascript
var promise = new Promise((resolve,reject) => {
    setTimeout(function(){
        resolve('test simplePromise resolve')
    },100)
})

setTimeout(() => {
    promise.then(function(value){
        console.log('success:',value)
    },function(reason){
        console.log('failed:',reason)
    })
    console.log('end')
}, 200);
```

结果：

```javascript
success: test simplePromise resolve
end
```

是不是感觉哪里不对劲？是的，为什么`end`会在`success`之后打印？Promise不就是来解决异步的吗？

从上面可以分析出，我们then方法中的传入的onFulfilled和onRejected方法执行时机不正确。它应该是异步执行。这一点也正是规范2.2.4规定的，不清楚的可以看下规范。

那既然异步执行，那就再套一层马甲呗，setTimeout不就可以模拟异步执行嘛，那我们就用setTimeout改造一下。

### 异步调用then回调函数

```javascript
newPromise = new Promise(function(resolve,reject){
    setTimeout(function () {
        try{
            let x = onFulfilled(_this.value)
            resolve(x)
        }catch(e){
            reject(e)
        }
    })

})

newPromise = new Promise(function(resolve,reject){
    setTimeout(function () {
        try{
            let x = onRejected(_this.reason)
            resolve(x)
        }catch(e){
            reject(e)
        }
    })

})

newPromise = new Promise(function(resolve,reject){
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
```

验证`Q5`发现，打印出的结果是符合我们预期的。那我们再验证下其他的异步情况

`Q6`

```javascript
setTimeout(()=>{
    console.log(5)
})
new Promise((resolve,reject)=>{
    console.log(1)
    resolve(3)
    Promise.resolve(4).then((value)=>{
        console.log(value)
    })
})
console.log(2)
```

结果：`1，2，5，4，3`。我们用原生的验证下，发现结果是`1，2，4，3，5`，那我们的为什么和原生的结果不一样呢？这要从JS的执行机制娓娓道来！

上图说话：

![](http://ody1t82mr.bkt.clouddn.com/2018-05-25-15272186536477.jpg)

从上图中可以看出，js的事件循环是先执行宏任务，再执行微任务。每一次执行一个宏任务，都去查看微任务队列，如果有微任务，就执行所有的微任务队列。

宏任务和微任务的分类如下：

- **macro-task:** script（整体代码）, `setTimeout`, `setInterval`, `setImmediate`, I/O, UI rendering
- **micro-task:** `process.nextTick`, `Promise`（原生 Promise）,`Object.observe`, `MutationObserver`

根据这个分类，`Q6`的执行过程可以表示为

![](http://ody1t82mr.bkt.clouddn.com/2018-05-25-15272204338046.jpg)

整个流程如下：先执行宏任务中的整体代码，遇到setTimeout，它属于宏任务，放到宏任务队列里面，然后执行promise构造函数，打印1。Promise是个微任务，会把构造函数内部promise的`console.log(4)`放到微任务中，然后外面promise中的`console.log(3)`。继续执行打印2。当前宏任务执行完毕，执行微任务队列，打印4，3。微任务队列为空，继续执行宏任务，打印5，整个流程结束，结果`12435`。

梳理完上面的流程，我们再看我们的代码为什么输出`12543`，就能明白，我们使用setTimeout宏任务来异步执行我们的then回调方法是不合适的。

所以说，我们要把setTimeout替换成微任务方法(推荐使用**immediate**这个库)，比如process.nextTick，你可以去验证下，结果肯定是`12435`了。浏览器环境可以使用

```javascript
function (callback) {
    if (typeof callback !== 'function')
        throw new TypeError('callback is not a function');
    var Mutation = window.MutationObserver || window.WebKitMutationObserver;
    var observer = new Mutation(callback);
    var element = document.createTextNode('');
    observer.observe(element, {
        characterData: true
    });
    element.data = 1;
} 
```

我们就用process.nextTick来改造。

下面来看下一个问题：

`Q7`

```javascript
//---------------promise
new Promise((resolve, reject) => {
    resolve(new Promise((resolve) => {
        resolve(1)
    }))
}).then((value) => {
    console.log('success1:', value)
}, (reason) => {
    console.log('failed1:', reason)
})
```

结果：

```javascript
success1: Promise {
  status: 'resolved',
  value: 1,
  reason: null,
  onRejectedCallbacks: [],
  onResolvedCallbacks: [] }
```

使用原生的Promise运行，结果是

```
success1: 1
```

不仅打印的结果不一样，打印的顺序也不一样。下面的情况一样我们无法处理：

1.传进来的是当前promise

2.thenable

```javascript
new Promise((resolve, reject) => {
    resolve({
        then: (resolve,reject)=>{
            resolve(1)
        }
    })
}).then((value) => {
    console.log('success2:', value)
}, (reason) => {
    console.log('failed2:', reason)
})
```



3.或者一调用就出错的thenable

```javascript
let promise = {}
Object.defineProperty(promise,'then',{
    value: function(){
        throw new Error('出错了吧')
    }
})
```

4.调用了resolve，又调用了reject

```javascript
new Promise((resolve, reject) => {
    resolve(new Promise((resolve) => {
        resolve(1)
    }))
    reject('error')
}).then((value) => {
    console.log('success1:', value)
}, (reason) => {
    console.log('failed1:', reason)
})
```

等等。

其实这些规范都考虑到了。

要解决这个问题，还得回到上面我们总结的第四个核心点

> 4.then方法返回的promise中的必须包含一个resolve方法，能够处理上一个promise的onFulfilled/onRejected返回的各种类型的值x和直接传入的各种类型的值；也就是说，它的resove方法，能够接受各种类型的数据，并最终接受一个普通值。

这也是规范里面2.3规定的。下面我们来一点点的按照规范依葫芦画瓢，写出一个复合规范的resolve。

### resolvePromise

1. 首先改造Promise构造函数中的resolve

```javascript
function resolve(value) {
    resolvePromise(_this,value,fulfill,reject)
}

function fulfill(value){ //只接受普通值，不接受promise和thenable
    if (_this.status === 'pending') {
        _this.status = 'resolved'
        _this.value = value
        _this.onResolvedCallbacks.forEach(function (fn) {
            fn()
        })
    }
}
```

我们将原来的resolve改成了fulfill方法，现在你应该能明白上面提到的fulfill和resolve不是一个概念了吧！

> fulfill只是一个状态改变器并且在改变完状态之后使用传进来的普通值，调用回调数组里面的回调函数。
>
> resolve是将传进来的数据，处理成一个普通值，并根据处理的情况，决定是否fulfill还是reject。

下面重点讲解resolvePromise：

```javascript
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
```

上面的注释已经很详细了，包括了规范规定的所有异常处理。

这里有个疑点需要重点解释一下，我们看到上述代码中出现的

```javascript
if (called) return 
called = true
```

called变量是干嘛的？fulfill和resolve不是有控制状态变化的逻辑吗？

这个要通过下面的例子来进行解释

```javascript
new Promise((resolve,reject)=>{
    resolve({
        then:(onFulfilled,onRejected)=>{
            onFulfilled(new Promise((resolve1)=>{
                setTimeout(()=>{
                    resolve1(456)
                },1000)
            }))
            onRejected(789)
        }
    })
}).then((value)=>{
    console.log('success:',value)
},(reason)=>{
    console.log('reject:',reason)
})
new Promise((resolve,reject)=>{
    resolve(new Promise((resolve,reject)=>{
        	resolve(new Promise((resolve1)=>{
                setTimeout(()=>{
                    resolve1(456)
                },1000)
            }))
            reject(789)
    })
}).then((value)=>{
    console.log('success:',value)
},(reason)=>{
    console.log('reject:',reason)
})



new Promise((resolve,reject)=>{
    resolve(new Promise((resolve1,reject1)=>{
        setTimeout(()=>{
            resolve1(1)
        })
    }))
    reject(2)
}).then((value)=>{
    console.log('success:',value)
},(reason)=>{
    console.log('reject:',reason)
})
```

上面的这种情况，因为这个thenable对象没有状态管理机制，而且它里面的then方法还没有按照规范来写，要么onFulfilled，要么onRejected。

called变量的作用：

> 使得当前的promise的状态改变，不因为传入的promise或者thenable对象的状态的延迟改变而受影响。

```javascript
new Promise((resolve,reject)=>{
    resolve(new Promise((resolve1,reject1)=>{
        setTimeout(()=>{
            resolve1(1)
        })
    }))
    reject(2)
}).then((value)=>{
    console.log('success:',value)
},(reason)=>{
    console.log('reject:',reason)
})
```

## 终极实现-Promise

