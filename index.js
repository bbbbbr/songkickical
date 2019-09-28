//
// Songkick API -> iCal bridge
//
// This software is licensed under CC-BY-NC-SA (c) 2019
// https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode
//

const ical    = require('ical-generator');
const moment  = require('moment');

const http        = require('http');
const querystring = require('querystring');
const request     = require('request');

const PORT    = process.env.PORT || 5000;
const SONGKICK_KEY = process.env.SONGKICK_API_KEY;
const cal     = ical({domain: 'TODO.com', name: 'Music Event ical'});


// Query string parameters
const q_username = "username"

// Songkick Api parameter
const p_apikey   = "PARAM_APIKEY"
const p_username = "PARAM_USERNAME"
const p_reason   = "PARAM_REASON"


// TODO: cache reponse data + time/date, + name re-request if over threshold (up to N limit entries)
// TODO: color for marked vs unmarked events  COLOR:turquoise (reason.attendance = "i_might_go" "im_going"

// overwrite domain
cal.domain('TODOTODOTODO.net');


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

function serve_calendar (client_response) {
    try {
        cal.serve(client_response);
    }
    catch(err) {
        console.log('serve_calendar() failed !' + err);
    };
}


function songkick_event_log (cal_event) {

    try {
        var tdate = cal_event.event.start.datetime;

        console.log("\n---- EVENT ----");
        console.log("start: " + moment(tdate));
        console.log("summary: " + cal_event.event.displayName);
        console.log("description: " + cal_event.event.displayName + ", " + cal_event.event.uri);
        console.log("location: " + cal_event.event.venue.displayName + ", " + cal_event.event.venue.metroArea.displayName);
        console.log("url: " + cal_event.event.uri);
    }
    catch(err) {
        console.log('songkick log calendar event failed' + err);
    };
}


function songkick_event_add (cal_event) {

    try {
        var tdate = cal_event.event.start.datetime;

        // Create an event
        cal.createEvent({
            start: moment(tdate),
            summary: cal_event.event.displayName,
            description: cal_event.event.displayName + ", " + cal_event.event.uri,
            location: cal_event.event.venue.displayName + ", " + cal_event.event.venue.metroArea.displayName,
            url: cal_event.event.uri
        });
    }
    catch(err) {
        console.log('songkick create calendar event failed' + err);
    };

}


function songkick_parse_events (req_response_bodyJSON, client_response) {

    var data = {};
    try {
        // Parse the data
        //var songkick_calendar = JSON.parse(req_response_body);

        req_response_bodyJSON.resultsPage.results.calendarEntry.forEach(function (sk_cals) {


            try {
                // songkick_event_log(sk_cals);

                songkick_event_add(sk_cals);
            }
            catch(err) {
                console.log('songkick create calendar event failed' + err);
            };
        });

        // End of adding the calendar items, serve up the response
        serve_calendar(client_response);
    }
    catch(err) {
        console.log('songkick_parse_events() failed' + err);
        serve_error(client_response);
    };

}




function songkick_request_events (req_url, client_response) {

    try {
        console.log ('Calling songkick_request_events()');
        request(req_url, { json: true }, (err, res, bodyJSON) => {

            if (err) { return console.log(err); }

            // console.log(bodyJSON);

            // Handle the JSON calendar response
            songkick_parse_events(bodyJSON, client_response);
        });
    }
    catch(err) {
        console.log('songkick_request_events() failed' + err);
        serve_error(client_response);
    };

}


// Build a request URL for the songkick API
function songkick_build_request_url (user_params) {

    var req_params = {};
    var req_url    = 'https://api.songkick.com/api/3.0/users/PARAM_USERNAME/calendar.json?reason=PARAM_REASON&apikey=PARAM_APIKEY';

    // console.log ('songkick_build_request_url()');
    // console.log (user_params);

    try {

        // Function request_url_populate()
        req_params[p_apikey]   = SONGKICK_KEY;
        req_params[p_reason]   = 'tracked_artist'; // 'tracked_artist' or 'attendance'

        if (user_params[q_username] != '') {
            req_params[p_username] = user_params[q_username];
            // console.log('1 username:' + user_params[q_username]);
        }
        else
            throw "empty username param";

        // filter out non-numeric values
        req_params[p_username] = req_params[p_username].replace(/[^a-zA-Z0-9]+/g, '');

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
    }
    catch(err) {
        console.log('user_request_get_params() failed');
        // Return empty params values
        user_params = {};
    };

    // console.log(user_params);
    return (user_params);
}



// Serve the calendar
http.createServer(function(req, res) {

    // Reset the calendar
    cal.clear();

    var req_url = songkick_build_request_url( user_request_get_params(req) );

    if (req_url) {
        // This will either serve up a calendar or an error in response
        songkick_request_events(req_url, res)
    }
    else
        serve_error(res);


}).listen(PORT, () => {
  console.log(`Server running on ${PORT}/`);
});
