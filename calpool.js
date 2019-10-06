// calpool.js
// ========


// Simple calendar result caching
const DATE_ONE_HOUR = 60 * 60 * 1000; // msecs
const CAL_POOL_CACHE_LIFE_HOURS = 24 * DATE_ONE_HOUR;
const CAL_POOL_SIZE = 1000; // Maximum number of calendars to store.


module.exports = {

    // Get a calendar entry object:
    //
    // * Exists and not expired: Returns object, .valid == true
    // * Exists and expired:     Returns object, .valid == false
    //                           + (re-inserts to newer end of pool)
    // * Doesn't exist:          Returns object, .valid == false
    //                           + (Creates new, prunes from old end of pool if needed)
    // * Something went wrong:   Returns undefined
    get_entry: function (cal_map, username) {

        var cal_obj;

        try {
            // Check if entry exists
            if (typeof cal_map.get(username) !== 'undefined') {

                // If it's expired, get a new entry
                // If not expired, get a copy of the existing one
                if (cal_map.get(username).expired()) {
                    console.log ('cal_pool_get_entry() - found but expired');
                    cal_obj = cal_obj_get_new();
                }
                else {
                    console.log ('cal_pool_get_entry() - found and not expired, copying');
                    cal_obj = cal_map.get(username);
                }

                // Delete it's old location in the queue
                cal_map.delete(username);
            } else {
                // If it doesn't exist, create a new entry
                console.log ('cal_pool_get_entry() - not found, creating new');
                cal_obj = cal_obj_get_new();
            }

            // Add or re-add the entry to the newer end of the queue
            cal_map.set(username, cal_obj);

            prune_if_needed(cal_map);

            return cal_map.get(username); // Return the entry
        }
        catch (err) { console.log('cal_pool_get_entry() failed: ' + err); }

        // Error condition, return undefined by default
        return (undefined);
    }

};



// Create a new calendar cache entry and return the object
function cal_obj_get_new () {

    try {
        var cal_obj = {
            valid    : false,
            datetime : new Date(),
            cal      : ical({domain: 'songkickicalweb.herokuapp.com', name: 'Music Event ical'}),
            expired  : function () {
                return (((new Date()) - this.datetime) > CAL_POOL_CACHE_LIFE_HOURS)
                }
        }
    }
    catch (err) { return false; }

    return (cal_obj);
}


function prune_if_needed (cal_map) {
    try {
        // Prune oldest (first) entry from pool queue if space is needed
        if (cal_map.size > CAL_POOL_SIZE) {
            for (const [key] of cal_map) {
                cal_map.delete(key);
                break; // Break after first iteration
            }
        }
    }
    catch (err) { console.log('cal_pool_prune_if_needed() failed: ' + err); }
}

