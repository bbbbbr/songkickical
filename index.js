//
// Songkick API -> iCal bridge
//
// This software is licensed under CC-BY-NC-SA (c) 2019
// https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode
//

const http         = require('http');
const querystring  = require('querystring');

const PORT         = process.env.PORT || 5000;

const calpool      = require('./calpool');
const songkick     = require('./songkickapi');
const config       = require('./config');


var calendar_pool  = new Map(); // Use a Map since it maintains iteration order of entries (oldest -> newest)


// TODO: option to show events marked as going/interested only
//       const q_display  = "display"   // "all", "onlyfaved", "<empty, treated as all>"


function serve_error (client_response) {
    try {
        client_response.status(400).send({
           message: 'Error serving calendar!'
        });
    }
    catch(err) {
        console.log('serve_error() failed !' + err);
    };

}

function serve_calendar (client_response, cal) {
    try {
        cal.serve(client_response);
    }
    catch(err) {
        console.log('serve_calendar() failed !' + err);
    };
}



// Parse the query string from a client request
// into a hash of parameters
function user_request_get_params(req) {

    var user_params = {};
    var req_querystring;

     try {
        console.log(req.url);

        // Remove everything before the query string
        req_querystring = req.url.replace(/^.*\/\?/g, '');

        // Parse query string
        user_params = querystring.parse(req_querystring);

        // Sanitize inputs that are used
        // username: filter out unwanted username characters
        user_params[config.q_username] = user_params[config.q_username].replace(/[^a-z0-9\-\_]+/g, '');
    }
    catch(err) {
        console.log('user_request_get_params() failed');
        // Return empty params values
        user_params = {};
    };

    // console.log(user_params);
    return (user_params);
}



// Request the events and then serve the calendar
http.createServer(function(req, res) {

    try {

        // Set up http response functions for calendar to call
        songkick.set_serve_functions(serve_calendar, serve_error);

        // Get the username from query string
        var user_params = user_request_get_params(req);

        // Abort if username is empty
        if ((user_params[config.q_username] === '') ||
            !(config.q_username in user_params) ) {
            // console.log ('main - username empty');
            throw "Empty username param";
        }

        // Get calendar object from pool
        var cal_obj = calpool.get_entry(calendar_pool, user_params[config.q_username]);

        // Abort if obtaining a calendar object failed
        if (typeof cal_obj === 'undefined') {
            // console.log ('main - cal_obj undefined');
            serve_error(res);
        }
        else {

            // console.log ('main - found cal object');
            // Serve cached calendar if valid
            if (cal_obj.valid == true) {
                serve_calendar(res, cal_obj.cal);
                // console.log ('main - serving existing calendar');
            }
            else {
                // console.log ('main - requesting new calendar');
                // Otherwise start a new request
                var req_url = songkick.build_request_url(user_params);

                if (req_url) {
                    // This will either serve up a calendar or an error in response
                    songkick.request_events(req_url, res, cal_obj)
                }
                else
                    serve_error(res);
            }
        }
    }
    catch(err) {
        console.log('serve - failed' + err);
        serve_error(res);
    };

    // console.log(' ');
    // console.log('==== CACHE POOL: ==== ');
    // console.log(calendar_pool.size)
    // console.log(calendar_pool)

}).listen(PORT, () => {
  console.log(`Server running on ${PORT}/`);
});
