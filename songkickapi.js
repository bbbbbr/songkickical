// ==============
// songkickapi.js
// ==============


const moment       = require('moment');
const request      = require('request');
const config       = require('./config');

const SONGKICK_KEY = process.env.SONGKICK_API_KEY;

// Songkick Api parameters
const p_apikey   = "PARAM_APIKEY",
const p_username = "PARAM_USERNAME",
const p_reason   = "PARAM_REASON"


var serve_calendar_fn;
var serve_error_fn;

module.exports = {

    set_serve_functions: function (serve_cal_fn, serve_err_fn) {
        serve_calendar_fn = serve_cal_fn;
        serve_error_fn = serve_err_fn;
    },

    request_events: function (req_url, client_response, cal_obj) {

        try {
            // console.log ('Calling songkick_request_events()');
            request(req_url, { json: true }, (err, res, bodyJSON) => {

                if (err) { return console.log(err); }

                // console.log(bodyJSON);

                // Handle the JSON calendar response
                parse_events(bodyJSON, client_response, cal_obj);
            });
        }
        catch(err) {
            console.log('songkick_request_events() failed' + err);
            serve_error_fn(client_response);
        };

    },


    // Build a request URL for the songkick API
    build_request_url: function (user_params) {

        var req_params = {};
        var req_url    = 'https://api.songkick.com/api/3.0/users/PARAM_USERNAME/calendar.json?reason=PARAM_REASON&apikey=PARAM_APIKEY';

        // console.log ('songkick_build_request_url()');
        // console.log (user_params);

        try {

            // Function request_url_populate()
            req_params[p_apikey]   = SONGKICK_KEY;
            req_params[p_reason]   = 'tracked_artist'; // 'tracked_artist' or 'attendance'

            // Copy in username
            if (user_params[config.q_username] != '')
                req_params[p_username] = user_params[config.q_username];
            else
                throw "empty username param";
                        // Insert the param values into the request url string
            req_url = req_url.replace(p_apikey, req_params[p_apikey]);
            req_url = req_url.replace(p_username, req_params[p_username]);
            req_url = req_url.replace(p_reason, req_params[p_reason]);

            console.log('Req Songkick URL:' + req_url);

        }
        catch(err) {
            console.log('songkick_build_request_url() failed' + err);
            req_url = ''; // return empty request url on failure
        };

        return (req_url)
    }

};



function event_log (cal_event) {

    try {
        var tdate = cal_event.event.start.datetime;

        console.log("\n---- EVENT ----");
        console.log("start: " + moment(tdate));
        console.log("summary: " + cal_event.event.displayName);
        console.log("description: " + cal_event.event.displayName + ", " + cal_event.event.uri);
        console.log("location: " + cal_event.event.venue.displayName + ", " + cal_event.event.venue.metroArea.displayName);
        console.log("url: " + cal_event.event.uri);
    }
    catch(err) { console.log('songkick log calendar event failed' + err); };
}


function event_checkattending (cal_event) {
    // TODO: color for marked vs unmarked events?  "COLOR:turquoise" (not supported by ical generator)
    var attend_str = '';

    try {
        if (cal_event.reason.attendance === 'i_might_go' ||
            cal_event.reason.attendance === 'im_going') {

            // Add some hearts if attending
            attend_str = '♥ ';
        }
    }
    catch(err) {
        // console.log('songkick_event_add() -> attendance not present ' + err);
    };

    return (attend_str);
}


function event_add (cal_event, cal_obj) {

    var attend_str = event_checkattending (cal_event);

    try {
        var tdate = cal_event.event.start.datetime;

        // Create an event
        cal_obj.cal.createEvent({
            start: moment(tdate),
            summary: attend_str + cal_event.event.displayName,
            description: attend_str + cal_event.event.displayName + ", " + cal_event.event.uri,
            location: cal_event.event.venue.displayName + ", " + cal_event.event.venue.metroArea.displayName,
            url: cal_event.event.uri
        });
    }
    catch(err) {
        // console.log('songkick create calendar event failed' + err);
    };

}


function parse_events (req_response_bodyJSON, client_response, cal_obj) {

    var data = {};
    try {
        // Parse the data
        //var songkick_calendar = JSON.parse(req_response_body);

        req_response_bodyJSON.resultsPage.results.calendarEntry.forEach(function (sk_cals) {

            try {
                // event_log(sk_cals);
                event_add(sk_cals, cal_obj);
            }
            catch(err) {
                console.log('songkick create calendar event failed' + err);
            };
        });

        // Set calendar to valid
        cal_obj.valid = true;

        // End of adding the calendar items, serve up the response
        serve_calendar_fn(client_response, cal_obj.cal);
    }
    catch(err) {
        console.log('parse_events() failed' + err);
        serve_error_fn(client_response);
    };

}


