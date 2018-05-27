// var SPromise = require('./PPT1_simplePromise_withcatchError_4')
//
// new SPromise(resolve => {
//     console.log(1);
//     resolve(3);
//     new SPromise((resolve) => {
//         resolve()
//     }).then(() => console.log(4))
// }).then(num => {
//     console.log(num)
// });
//
// console.log(2)
// setTimeout(()=>{
//     console.log(5)
// })
// new SPromise(resolve => {
//     console.log(1);
//     resolve(3);
//     new SPromise((resolve) => {
//         resolve()
//     }).then(() => console.log(4))
// }).then(num => {
//     console.log(num)
// });
//
// console.log(2)


// new Promise((resolve,reject)=>{
//     resolve(new Promise((resolve,reject)=>{
//         resolve(1)
//     }))
// }).then((value)=>{
//     console.log(value)
// },(reason)=>{
//     console.log(reason)
// })

//--------testCode-----------

(function (type) {

    return [() => {
    }, ()=>{

        //5.2
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

    },() => {
        //6.2 //primary
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

    }, () => {
        //6.settimeout
        var Promise = require('./prototype/promise_async_then_6')

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

    }, () => {
        //3.nextTick
        var Promise = require('./prototype/promise_nextTick_7')

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

    }, () => {
        //4.transmit value: 6 not work
        var Promise = require('./prototype/promise_nextTick_7')

        var p = new Promise(resolve=> {
            resolve(3);
        })
        p.then().then().then((value) => {
            console.log(value)
        });
    },() => {
        //5.transmit value: 7 ok
        var Promise = require('./prototype/promise_transmit_value_5')

        var p = new Promise(resolve => {
            resolve(3);
        })
        p.then().then().then((value) => {
            console.log(value)
        });
    }][type]

}(2)())