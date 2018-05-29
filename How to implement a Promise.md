声明：本篇文章不是讲Promise如何使用的。如果还不清楚，请移步：[http://es6.ruanyifeng.com/#docs/promise](http://es6.ruanyifeng.com/#docs/promise )  ，阮一峰老师讲的通俗易懂！

用了很久Promise，大家应该都很熟悉了吧！既然那么熟了，下面几个问题，了解一下？

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

要正确解释上面的问题，你需要充分的了解JS的运行机制以及Promise的实现原理。本文的目的就是让你明白Promise到底是个什么东西。

下面，我们从一个Promise雏形开始，通过打补丁的方式，一步一步实现一个完整的Promise。Promise的原理，顺其自然就明白了！

## PromiseA+规范

首先来看下规范，[https://promisesaplus.com](https://promisesaplus.com)。是不是顿时又懵逼了，这么长，这都是啥和啥啊。。。

别怕，我简单总结了下它的核心点，也就四个：

1.Promise是一个状态机，有三种状态pending，fulfilled，rejected。只能从pending状态，转换为fulfilled或者rejected，不可逆转且无第三种状态转换方式。

2.必须提供一个then方法用以处理当前值：终值和据因。then接收两个参数onFufilled，onRejected分别处理fulfilled和reject的结果。

3.then方法必须返回一个新的Promise , 便于链式调用。

4.Promise中必须包含一个resolve方法，能够接受各种类型的值，将其处理成普通值fulfilled或者直接rejected

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

从上面的代码中，promise里面的东西是很健全的：有改变promise装态的两个方法resolve(确切的说，这个方法应该叫fulfill，fulfill和resolve是概念是不一样的，后面会解释原因)和reject，有管理状态的status，保存fulfilled状态值的value和rejected拒因的reason，还包含了一个then方法用来处理fulfilled的值和rejected的据因（还有一行`小注释`）。

试验一下效果:

```javascript
var promise = new Promise((resolve, reject) => {
    resolve('test simplePromise resolve')
})

promise.then(function (value) {
    console.log('success:', value)
}, function (reason) {
    console.log('failed:', reason)
})
```

妥妥的`success:test simplePromise resolve`，基本什么问题，有点promise的样子。

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

你会发现，结果什么反应都没有。。。

从这里可以看出，它还不能处理异步的情况。不能处理异步，那叫什么Promise。要支持异步，then方法里面的参数就不能立即执行。既然不能立即执行，那就必须找地方，先保存起来！

### 支持异步

在Promise构造函数中添加两个回调数组

```javascript
_this.onFulfilledCallbacks = []
_this.onResolvedCallbacks = []
```

在then方法中添加

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

好了，这样就实现了异步调用，用`Q1`测试是没有问题的。增量代码：[https://github.com/yonglijia/JSPI/blob/master/prototype/promise_async_2.js](https://github.com/yonglijia/JSPI/blob/master/prototype/promise_async_2.js)

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

> 这里需要解释一下：newPromise的状态不能因为上一个promise被reject了，而更改newPromise的状态；也就是说上一个promise无论被 reject 还是被 resolve ， newPromise 都会被 resolve，只有出现异常时才会被 rejecte。

`Q2`链式调用的问题也就解决了。增量代码：[https://github.com/yonglijia/JSPI/blob/master/prototype/promise_chain_3.js](https://github.com/yonglijia/JSPI/blob/master/prototype/promise_chain_3.js)。

那，抛个错误玩玩？看下 `Q3`

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

结果：`Error: error.....`，一堆错误，还是太年轻，经不起一点挫折啊。。。

### 异常处理

来吧，继续打补丁，加上错误处理

```javascript
if (!(this instanceof Promise)) {
    return new Promise(executor);
}

if (typeof executor !== 'function') {
    throw new TypeError('Promise executor is not a function');
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

再来看上面的结果：`reject: Error: error`，程序并不会崩溃，处理异常就是这么淡定！增量代码：[https://github.com/yonglijia/JSPI/blob/master/prototype/promise_withCatchError_4.js](https://github.com/yonglijia/JSPI/blob/master/prototype/promise_withCatchError_4.js)

> 人生从来都不是一帆风顺的，有一个坑，就会有更多坑！

比如下面的问题跑个试试，`Q4`

```javascript
new Promise((resolve,reject)=>{
    resolve(1)
}).then().then().then((value)=>{
    console.log(value)
},(reason)=>{console.log(reason)})
```

结果:`TypeError: onRejected is not a function`，怎么又变成了车祸现场了?按照原生的Promise，不是应该打印`1`吗？`1`哪里去了，毫无疑问，丢了！丢了，那就把它找回来。

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

搞定！增量代码：[https://github.com/yonglijia/JSPI/blob/master/prototype/promise_transmit_value_5.js](https://github.com/yonglijia/JSPI/blob/master/prototype/promise_transmit_value_5.js)

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

从上面可以分析出，then方法中的传入的onFulfilled和onRejected方法执行时机不正确。它应该是异步执行。这一点也正是规范2.2.4规定的，不清楚的可以看下规范。

那既然异步执行，那就再套一层马甲呗，setTimeout不就可以模拟异步执行嘛，那就用setTimeout改造一下试试。

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

验证`Q5`发现，打印出的结果是符合我们预期的。增量代码：[https://github.com/yonglijia/JSPI/blob/master/prototype/promise_async_then_6.js](https://github.com/yonglijia/JSPI/blob/master/prototype/promise_async_then_6.js)。那再验证下其他的异步情况

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
}).then((value)=>{
  console.log(value)  
})
console.log(2)
```

结果：`1，2，5，4，3`。

用原生的验证下，发现结果是`1，2，4，3，5`，那我们的为什么和原生的结果不一样呢？这要从JS的执行机制娓娓道来！

上图说话：

![](http://ody1t82mr.bkt.clouddn.com/2018-05-25-15272186536477.jpg)

从上图中可以看出，js的事件循环是先执行宏任务，再执行微任务。每一次执行一个宏任务，都去查看微任务队列，如果有微任务，就执行所有的微任务队列。（这里不细说，详细可参考：[https://juejin.im/post/59e85eebf265da430d571f89](https://juejin.im/post/59e85eebf265da430d571f89)）

宏任务和微任务的分类如下：

- **macro-task:** script（整体代码）, `setTimeout`, `setInterval`, `setImmediate`, I/O, UI rendering
- **micro-task:** `process.nextTick`, `Promise`（原生 Promise）,`Object.observe`, `MutationObserver`

根据这个分类，`Q6`的执行过程可以表示为

![](http://ody1t82mr.bkt.clouddn.com/2018-05-25-15272204338046.jpg)

整个流程如下：先执行宏任务中的整体代码，遇到setTimeout，它属于宏任务，放到宏任务队列里面，然后执行Promise构造函数，打印1。Promise是个微任务，会把构造函数内部Promise的`console.log(4)`放到微任务中，然后外面Promise中的`console.log(3)`。继续执行打印2。当前宏任务执行完毕，执行微任务队列，打印4，3。微任务队列为空，继续执行宏任务，打印5，整个流程结束，结果`12435`。

梳理完上面的流程，再看我们的代码就能明白，使用setTimeout宏任务来异步执行then回调方法是不太合适的，应该把setTimeout替换成微任务方法(推荐使用**immediate**这个库)，比如process.nextTick，你可以去验证下，结果肯定是`12435`了。浏览器环境可以使用`MutationObserver`。我封装了下asyncCall

```javascript
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
```

这里简单起见，就先用process.nextTick来改造。增量代码：[https://github.com/yonglijia/JSPI/blob/master/prototype/promise_nextTick_7.js](https://github.com/yonglijia/JSPI/blob/master/prototype/promise_nextTick_7.js)

下面来看下一个问题：

`Q7`

```javascript
new Promise((resolve, reject) => {
    resolve(new Promise((resolve) => {
        resolve(1)
    }))
}).then((value) => {
    console.log('success:', value)
}, (reason) => {
    console.log('failed:', reason)
})
```

结果：

```javascript
success: Promise {
  status: 'resolved',
  value: 1,
  reason: null,
  onRejectedCallbacks: [],
  onResolvedCallbacks: [] }
```

使用原生的Promise运行，结果是

```
success: 1
```

我们无法正确处理，写的不符合规范，也就是对传入进来的值没有进行任何处理。对于下面的异常情况，我们一样无法处理：

1. 传进来的是当前promise
2. thenable

```javascript
new Promise((resolve, reject) => {
    resolve({
        then: (resolve,reject)=>{
            resolve(1)
        }
    })
}).then((value) => {
    console.log('success:', value)
}, (reason) => {
    console.log('failed:', reason)
})
```

1. 或者一调用就出错的thenable

```javascript
let promise = {}
Object.defineProperty(promise,'then',{
    value: function(){
        throw new Error('出错了吧')
    }
})
```

1. 调用了resolve，又调用了reject

```javascript
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
```

等等。

其实这些规范都考虑到了。

要解决这个问题，还得先理解下上面我们总结的第四个核心点

> 4.Promise中必须包含一个resolve方法，能够接受各种类型的值，将其处理成普通值fulfilled或者直接rejected

这也是规范里面2.3规定的。下面我们来一点点的按照规范，写出一个复合规范的resolve。

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

将原来的resolve改成fulfill方法。现在你应该能明白上面提到的fulfill和resolve不是一个概念了吧！

> fulfill只是一个状态改变器并且在改变完状态之后使用传进来的普通值，调用回调数组里面的回调函数。
>
> resolve是将传进来的数据，处理成一个普通值，并根据处理的情况，决定是否fulfill还是reject。

来完善resolvePromise：

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
    fulfill(x)
}
```

我们先写到这里，验证下`Q7`,发现结果是正确的,`success: 1`。增量代码：[https://github.com/yonglijia/JSPI/blob/master/prototype/promise_without_called_8.js](https://github.com/yonglijia/JSPI/blob/master/prototype/promise_without_called_8.js)

再来折腾下，用现在的promise来执行另一个问题：`Q8`

```javascript
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
```

发现结果是：`failed:error`。为什么我们写的promise的状态不可控？

事实上是这样的，根据上面的resolvePromise，发现resolve接收的参数是一个promise，会去递归调用它的then方法，我们知道，then方法中包含微任务。然后就先执行了reject('error')，这个执行完毕，promise的状态从pending更新为reject。执行then方法，将onRejected方法放到微任务对列中。当resolve的微任务执行的时候，状态已经改变了，无法执行fulfill的操作。执行下一个微任务onRejected，打印了`failed:error`。

从这个问题可以看出，我们写的promise，resolve和reject的调用并不阻塞promise状态的更新。

标准只规定了，状态改变一次就不能改变了，并没有规定resolve和reject的调用，要阻塞状态更新。虽然并没有这么硬性规定，但是大家都是这么理解的，比如你可以运行浏览器，node原生promise以及第三方bluebird，Q，lie库等，都是resolve，reject调用的时候，会阻塞另一个方法的状态更新。这也符合常理，不能调用了resolve，再去调用reject，就乱套了 。

#### Promise状态阻塞更新

我们可以通过在Promise的构造函数中添加called变量的方式，来阻塞状态更新（从这里可以看出，在文章开头加的那个注释的意思了吧）。

```javascript
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
    console.log(e)
    reject(e)
}
```

再次运行`Q8`,结果：`success:1`。 增量代码：[https://github.com/yonglijia/JSPI/blob/master/prototype/promise_with_called_9.js](https://github.com/yonglijia/JSPI/blob/master/prototype/promise_with_called_9.js)

我们继续完善`resolvePromise`，来处理下`thenable`的情况

#### Handle thenable

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

这里有个疑点需要重点解释一下，我们看到上述代码中出现

```javascript
if (called) return 
called = true
```

called变量是干嘛的？我们不是刚加了这个变量吗？这里的变量和我们刚才添加的有什么不一样呢？

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
```

其实上面代码就类似于

```javascript
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
```

我们通过上面的代码中可以看出，`thenable`其实就是一个没有状态阻塞更新机制的`promise`。这里的called就相当于是为了防止调用了resolve又调用了reject乱套的问题。

## 完整代码

```javascript
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
}
module.exports = Promise
```



## 测试

首先你要暴露一个接口：

```javascript
Promise.deferred = Promise.defer = function () {
    var dfd = {}
    dfd.promise = new Promise(function (resolve, reject) {
        dfd.resolve = resolve
        dfd.reject = reject
    })
    return dfd
}
```

使用`promises-aplus-tests`这个库，具体使用方法，请移步它的github去查看吧，不详细介绍了。

```
npm install promises-aplus-tests
promises-aplus-tests myPromise.js
```

测试通过：

![20180528152746135184276.png](http://ody1t82mr.bkt.clouddn.com/20180528152746135184276.png)

完整代码：[https://github.com/yonglijia/JSPI/blob/master/prototype/promise_final_10.js](https://github.com/yonglijia/JSPI/blob/master/prototype/promise_final_10.js)

## 其他方法

```javascript
Promise.prototype.catch = function(callback){ 
    return this.then(null,callback)
}
Promise.resolve = function(value){ //返回一个promise
    return new Promise(function(resolve,reject){
        resolve(value);
    })
}
Promise.reject = function(value){//返回一个promise
    return new Promise(function(resolve,reject){
        reject(value);
    })
}
Promise.race = function(promise){//只要有一个成功了就resolve,有一个失败了就reject
    return new Promise(function (resolve,reject){
        for(var i = 0;i<promise.length;i++){
            promise[i].then(resolve,reject)
        }
    })
}
Promise.all = function(promises){ //所有的都成功了resolve，有一个失败了就reject
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
```

理解了Promise，上面其他的方法就很简单了，这里就不解释了。

## 终极代码

参见[https://github.com/yonglijia/JSPI/blob/master/lib/promise.js](https://github.com/yonglijia/JSPI/blob/master/lib/promise.js)
