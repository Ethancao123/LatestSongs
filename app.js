/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var numSongs = 10; //make this user definable in the future
var playlistExists = false;
var playlist = "music";
var existingPlaylistId;

const config = require('./config.json');
var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var readline = require('readline');

var client_id = config.id; // Your client id
var client_secret = config.secret; // Your secret
var redirect_uri = config.uri; // Your redirect uri

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email playlist-modify-public playlist-modify-private playlist-read-private playlist-read-collaborative';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          //console.log(body);
          //console.log(body.id)
          var userId = body.id
          var getRequest = {
            url: 'https://api.spotify.com/v1/users/' + userId + '/playlists',
            headers: { 'Authorization': 'Bearer ' + access_token },
            json: true
          };
          request.get(getRequest, function (error, response, body) {
            //console.error('error:', error); // Print the error if one occurred
            //console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            //console.log('body:', body); // Print the HTML for the Google homepage. 
            var playlistId;
            items = body.items
            var length;
            for(var i = 0; i < items.length; i++)
            {
              if(items[i].name === playlist) {
                playlistId = items[i].id
                length = items[i].tracks.total
              }
              else if(items[i].name == 'Latest ' + numSongs + ' Songs - ' + playlist)
              {
                playlistExists = true;
                existingPlaylistId = items[i].id;
                //console.log(existingPlaylistId)
              }
            }
            
            //console.log(playlistId)
            var getPlaylistItems = {
              url: 'https://api.spotify.com/v1/playlists/' + playlistId + '/tracks?offset=' + (length - numSongs),
              headers: { 'Authorization': 'Bearer ' + access_token },
              json: true
            };
            request.get(getPlaylistItems, function (error, response, body) {
              items = body.items
              //console.log(items)
              let tracks = new Array(numSongs)
              for(var i = 0; i < tracks.length; i++)
              {
                tracks[i] = items[i].track.uri
              }
              //console.log(typeof(tracks[1]))
              if(playlistExists == false)
              {
               let playlistName = 'Latest ' + numSongs + ' Songs - ' + playlist
               var requestData = {
                 name: playlistName,
                 description: 'This playlist was created by LatestSongs'
               };
               request({
                url: 'https://api.spotify.com/v1/users/' + userId + '/playlists',
                headers: { 'Authorization': 'Bearer ' + access_token },
                method: "POST",
                json: requestData
              }, function (error, response, body) {
                console.log(body)
                existingPlaylistId = body.id
              });
              }
              tracks.reverse()
              var requestData = {
                uris: tracks
              }
              request({
                url: 'https://api.spotify.com/v1/playlists/' + existingPlaylistId + '/tracks',
                headers: { 'Authorization': 'Bearer ' + access_token },
                method: "PUT",
                json: requestData
              }, function (error, response, body) {
                console.log(body)
                existingPlaylistId = body.id
              });
            });
          });
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
        
        



      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

console.log('Listening on 8888');
app.listen(8888);
