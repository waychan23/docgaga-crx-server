module.exports.deleteEmptyFields = deleteEmptyFields;

/**
 * @param {Object} obj - 
 * @param {Boolean} [deep=false] - 
 */
function deleteEmptyFields (obj, deep=false){
    var f, v;

    for(f in obj){
        if(obj.hasOwnProperty(f)){
            v = obj[f];
            if(v === undefined || v === null){
                delete obj[f];
                continue;
            }
            if(deep && typeof v == 'object' && !Array.isArray(v)){
                deleteEmptyFields(v);
            }
        }
    }
}