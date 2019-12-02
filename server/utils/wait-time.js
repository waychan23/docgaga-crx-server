
module.exports.milliseconds = function milliseconds(time){
    return new Promise((resolve, reject) => setTimeout(resolve, time));
}