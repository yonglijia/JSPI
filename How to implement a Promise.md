# 深究Promise的原理及其实现

回顾JavaScript的异步处理发展历程，JavaScript异步处理经过了`回调函数Callback`，`Promise`，`Generator`，`Async/Await`的演变。从回调地狱到`Async/Await`近似于同步的写法，可以说耗费了一代又一代人的心血。作为发展历程中的`Promise`，起到承前启后的作用，它用优雅的语法解决了回调地狱的问题，但离进化到完美又有一定的距离。即使如此，它优雅的设计依然受到很多人的青睐，依然是日常使用最高频的异步处理方式。它优雅的设计吸引着我对其内心的本质的探究，所以才有了本文的诞生。本文通过由浅入深的方式，一步一步揭开Promise神秘的面纱，探寻它优雅的设计是如何实现的。

首先来看下如何使用`Promise`，这里简单介绍下Promise是如何处理异步的：

看下面的例子

```javascript
getDataA((a)=>{
    getDataB(a,(b)=>{
        getDataC(b,(c)=>{
            console.log(c)
        }))
    })
})
```

getDataA、getDataB、getDataC都是异步的。getDataB依赖getDataA的结果，getDataC依赖getDataB的结果，三者通过回调的方式来处理依赖关系，可以看到如果依赖关系层级多的话，层级就会越来越深，最终形成`回调地狱`。

如果采用Promise的方式，我们可以将一个个过程抽象成Promise，然后将其链式调用，优雅的避开了多层回调的问题。

```javascript
const getDataA = function(){
    return new Promise((resolve,reject)=>{
    	resolve(a)
    })
}
const getDataB = function(a){
    return new Promise((resolve,reject)=>{
    	resolve(b)
    })
}

const getDataC = function(b){
    return new Promise((resolve,reject)=>{
    	resolve(c)
    })
}
getDataA().then(getDataB).then(getDataC).then((c)=>{
    console.log(c)
})
```

对比一下，下面的代码是不是更清晰一些，更容易理清楚每一个过程的依赖关系。

我们不禁好奇为什么通过这种方式就能解决异步回调？每个Promise里面做了什么？then为什么能链式调用？

带着这些疑惑，我们来研究下Promise的原理。从一个Promise雏形开始，通过打补丁的方式，一点一点的实现一个符合规范的Promise。

## PromiseA+规范

首先来看下规范，[https://promisesaplus.com](https://promisesaplus.com)。如果单纯的看这个规范，容易看的晕头转向，我简单总结了下它的核心点，也就四个：

1.Promise是一个状态机，有三种状态`pending`，`fulfilled`，`rejected`。只能从`pending`状态，转换为`fulfilled`或者`rejected`，不可逆转且无第三种状态转换方式。

2.必须提供一个then方法用以处理当前值：终值和据因。then接收两个参数onFufilled，onRejected分别处理fulfilled和rejected的结果。

3.then方法必须返回一个新的Promise , 便于链式调用。

4.Promise中必须包含一个`resolve`方法，能够接受各种类型的值，将其处理成普通值`fulfilled`或者直接`rejected`

## Promise雏形

根据上面总结的四点，先来实现一个promise的雏形：

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
    //暂时先不要问为什么这么写，文末分解
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

上面的代码中，Promise里面的东西是很健全的：有改变Promise装态的两个方法resolve(确切的说，这个方法应该叫fulfill，fulfill和resolve是概念是不一样的，后面会解释原因)和reject，有管理状态的status，保存fulfilled状态值的value和rejected拒因的reason，还包含了一个then方法用来处理fulfilled的值和rejected的据因。

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

结果：`success:test simplePromise resolve`，基本什么问题，有点promise的样子。

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

你会发现，什么反应都没有。从这里可以看出，它还不能处理异步的情况。

不能处理异步，那就不能称为Promise。要支持异步，then方法里面的参数就不能立即执行。既然不能立即执行，那就必须找地方先保存起来！

### 支持异步

在Promise构造函数中添加两个回调数组

```javascript
_this.onFulfilledCallbacks = []
_this.onRejectedCallbacks = []
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

再用`Q1`测试，就没有问题了。

下面来用`Q2`测试一下

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

结果是：`TypeError: Cannot read property 'then' of undefined`。这个结果表明，目前的Promise还不能解决链式调用的问题。

### 链式调用

要实现链式调用的功能，首先想到是then方法返回this。如果返回this的话，会有什么问题呢？

想象一下，经过第一个then方法之后，Promise的状态改变了，而状态改变一次就不能更改了，继续使用`this.then`，那它传入的`onFulfilled`,` onRejected`都无法执行，后面链式调用再多的then都不会执行。所以这条路行不通。

所以我们只有通过返回一个新的promise，为什么呢？因为新的Promise有then方法，可以实现链式调用。

继续对Promise的then进行改造

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

> 这里需要解释一下：newPromise的状态不能因为上一个promise被reject了，也reject；也就是说上一个promise无论被 reject 还是被 resolve ， newPromise 都会被 resolve，只有newPromise出现异常时才会被 reject。

再用`Q2`测试一下，发现链式调用的问题就解决了。

再来看下 `Q3`

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

结果：`Error: error…`，报了一堆错误。也就是说现在的Promise还不够健壮，还没有错误处理机制，在发生错误的时候，手足无措，不知道到底该`resove`还是`reject`。

### 异常处理

构造函数中

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

再来看上面`Q3`的结果：`reject: Error: error`，程序并不会崩溃。

再来看下`Q4`

```javascript
new Promise((resolve,reject)=>{
    resolve(1)
}).then().then().then((value)=>{
    console.log('resolve',value)
},(reason)=>{
    console.log('reject',reason)
})
```

结果:`reject TypeError: onRejected is not a function`，不应该打印`resolve 1`?按照原生的Promise，不是应该往下传递`1`吗？`1`哪里去了，毫无疑问，丢了！丢了，那我们就想办法把它找回来。

### 值穿透

先来解释一下为什么：第一个then里面没有传参，导致` onFulfilled`就取不到，下面的代码

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
```

中的` let x = onFulfilled(_this.value)`就会报错，会被捕获，然后`reject(e)`，第二个then里面同样没有传参

```javascript
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
```

`onRejected`也获取不到，同样`reject(e)`。传到最后一个，`reject TypeError: onRejected is not a function`。毫无疑问，当初`resolve`的`1`丢了。

我们可不可以这样：当你在`then`不传参数的时候，我们就给`onFulfilled`和`onRejected`默认一个方法，最起码不会造成`onFulfilled`和`onRejected`找不到的情况。既然默认一个方法了，实现值穿透就好办了，让它只做一件事情：给它传什么参数，它就返回什么参数。

我们可以在then方法中添加

```javascript
onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : function (value) {
    return value
}
onRejected = typeof onRejected === 'function' ? onRejected : function (err) {
    throw err
}
```

再来试验下`Q4`,结果就是`resolve 1`了。

回头看下，我们已经在这个`Promise`的雏形上打了不少补丁了：`异步调用`，`链式调用` ，`异常处理`，`值穿透`。但是这还远远不够，比如，下面的情况又没办法解决了。

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

是不是感觉哪里不对劲？从上面可以分析出，then方法中的传入的`onFulfilled`和`onRejected`方法执行时机不正确，他应该在`console.log('end')`之后执行，也就是说它应该是异步执行。这一点也正是规范`2.2.4`规定的。`setTimeout`可以模拟异步执行，先用`setTimeout`改造一下试试。

### 异步调用then回调函数

then方法中

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

验证`Q5`发现，打印出的结果是符合我们预期的。

```javascript
end
success: test simplePromise resolve
```

那是不是说我们这样改造一下就结束了呢？再来看下`Q6`

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

用原生的验证下，发现结果是`1，2，4，3，5`，原生的结果不一致!

要想弄清楚这是怎么回事，这要从`JS`的执行机制娓娓道来！

### JS的执行机制

上图说话：

![20180704153067134448578.png](http://ody1t82mr.bkt.clouddn.com/20180704153067134448578.png)

从上图中可以看出，`JS`的事件循环是先执行宏任务，再执行微任务。每一次执行一个宏任务，都去查看微任务队列，如果有微任务，就执行所有的微任务队列。

宏任务和微任务的分类如下：

- **macro-task:** `script（整体代码）`, `setTimeout`, `setInterval`, `setImmediate`, `I/O`,` UI rendering`
- **micro-task:** `process.nextTick`, `Promise（原生 Promise）`, `Object.observe`, `MutationObserver`

根据这个分类，`Q6`代码的执行过程可以表示为下图

![20180815153430430964513.png](http://ody1t82mr.bkt.clouddn.com/20180815153430430964513.png)

整个流程如下：先执行宏任务中的主体代码，遇到`setTimeout`，它属于宏任务，放到宏任务队列里面，然后执行Promise构造函数，打印`1`。Promise是个微任务，首先会把其内部Promise的`console.log(4)`放到微任务队列中，然后将其本身的微任务`console.log(3)`放到微任务队列里面。继续执行主体代码打印`2`。当前宏任务执行完毕，执行微任务队列，打印`4`，`3`。微任务队列为空，继续执行宏任务，打印`5`，整个流程结束，结果`12435`。

梳理完上面的流程，我们发现使用setTimeout宏任务来异步执行then回调方法是不合适的，应该把`setTimeout`替换成微任务方法，比如`process.nextTick`(推荐使用**immediate**这个库)，你可以去验证下，结果肯定是`12435`了。浏览器环境可以使用`MutationObserver`。我封装了下`asyncCall`

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

这里简单起见，先用`process.nextTick`代替`setTimeout`，优化下代码。到此为止，我们写的`promise`才是真正的异步调用`then`回调函数。

继续来看下一个问题，`Q7`

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

也就是说，`resolve`目前只能处理普通值（普通值就是除`promise`对象和`thenable`对象以外的基本数据类型）的参数。如果是一个`promise`对象，我们无法正确处理，也就是对传入进来的`resolve` 的参数没有进行任何处理。

不只是`promise`的对象无法处理，对于下面的参数，当前的`promise`雏形一样无法处理：

1. 当前`promise`
2. thenable对象（长的很像`promise`的对象，具有`then`方法）

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

3. 一调用就出错的thenable

```javascript
let promise = {}
Object.defineProperty(promise,'then',{
    value: function(){
        throw new Error('出错了吧')
    }
})
```

4. 调用了resolve，又调用了reject

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

要兼容这些类型，还得先理解下上面总结的第四个核心点

> 4.Promise中必须包含一个resolve方法，能够接受各种类型的值，将其处理成普通值fulfilled或者直接rejected

其实这些规范都考虑到了。下面我们按照规范2.3，一点点的写出一个复合规范的`resolve`。

### resolvePromise

首先改造`Promise`构造函数中的`resolve`，将原来的`resolve`改成`fulfill`方法。

```javascript
function resolve(value) {
    resolvePromise(_this,value,fulfill,reject)
}

function fulfill(value){ //只接受普通值，不接受promise和thenable
    if (_this.status === 'pending') {
        _this.status = 'fulfilled'
        _this.value = value
        _this.onResolvedCallbacks.forEach(function (fn) {
            fn()
        })
    }
}
```

现在你应该能明白上面提到的`fulfill`和`resolve`不是一个概念了吧！

> fulfill只是一个Promise状态改变器。状态改变后，使用传进来的普通值，调用回调数组里面的回调函数。
>
> resolve是将传进来的数据，处理成一个普通值，并根据处理的情况，决定调用`fulfill`还是`reject`来改变状态。

根据规范来完善resolvePromise：

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
            //状态确定，如果fulfill那传进来的肯定是普通值，如果reject直接处理，不管你抛出来的是什么
            x.then(fulfill, reject)
        }
        return;
    }
    fulfill(x)
}
```

先写到这里，验证下`Q7`，发现结果是正确：`success: 1`。

再来折腾下，用现在的promise来执行另一个问题：`Q8`

```javascript
const B = new Promise((resolve) => {
    resolve(1)
})
const A = new Promise((resolve, reject) => {
    resolve(B)
    reject('error')
})
A.then((value) => {
    console.log('success:', value)
}, (reason) => {
    console.log('failed:', reason)
})
```

结果是：`failed:error`。

根据总结的第一点

> Promise是一个状态机，有三种状态`pending`，`fulfilled`，`rejected`。只能从`pending`状态，转换为`fulfilled`或者`rejected`，不可逆转且无第三种状态转换方式

这是不正确的，也就是说我们写的Promise状态控制有问题。

先来看下为什么会有问题：根据上面的resolvePromise处理逻辑，A的resolve接收的参数是一个promise B，会去递归调用B的`then`方法。将B的then中的onFulfilled放到微任务队列中。继续执行A中的`reject('error')`，A的状态从pending更新为reject。执行A的then方法，将onRejected方法放到微任务对列中。当前微任务中包含了两个任务，一个是B的then方法中onFulfilled，一个是A的then方法中的onRejected。B的then方法中onFulfilled会去调用A的fulfill方法，但是A的状态已经改变了，无法执行fulfill的操作。执行下一个微任务A的onRejected，打印了`failed:error`。

从这个问题可以看出，我们写的promise，resolve和reject的调用并不阻塞promise状态的更新。

标准只规定了，状态改变一次就不能改变了，并没有规定resolve和reject的调用，要阻塞状态更新。虽然并没有这么硬性规定，但是大家都是这么理解的，比如你可以运行浏览器中、node中promise以及第三方bluebird，Q，lie库等，都是resolve，reject调用的时候，会阻塞promise状态更新。也就是说在调用了resolve以后，promise的状态不能被再次调用reject的时候改变直到resolve的过程结束。调用reject再调用resolve也是一样的。这也符合常理，不能调用了resolve，再去调用reject，就乱套了 。

#### Promise状态阻塞更新

我们可以通过在Promise的构造函数中添加called变量的方式，来阻塞状态更新。

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

再次运行`Q8`,结果：`success:1`。 

继续完善`resolvePromise`，来处理下`thenable`的情况

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

called变量是干嘛的？我们不是在Promise构造函数中刚加了这个变量吗？这里的变量和我们刚才添加的有什么不一样呢？

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

我们通过上面的代码中可以看出，`thenable`其实就是一个没有状态阻塞更新机制的`promise`。这里的called就相当于是为了防止调用了resolve又调用了reject的情况下Promise状态更新乱套的问题。

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
            _this.status = 'fulfilled'
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
    if (_this.status === 'fulfilled') {
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

使用`promises-aplus-tests`这个库，具体使用方法，请移步它的github去查看，不详细介绍了。

```
npm install promises-aplus-tests
promises-aplus-tests myPromise.js
```

测试通过：

![20180528152746135184276.png](http://ody1t82mr.bkt.clouddn.com/20180528152746135184276.png)

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

理解了Promise，上面其他的方法就很好理解了。

通过以上步骤就完成了一个符合规范的Promise。