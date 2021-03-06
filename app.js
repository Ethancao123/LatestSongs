var numSongs = 10; //make this user definable in the future
var playlistExists = false; //need to fix this later no clue how
var playlist = "music";
var existingPlaylistId;

const config = require('./config.json');
var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var cookieParser = require('cookie-parser');
var path = require('path');
var bodyParser = require("body-parser");
var delay = require('delay');
var querystring = require('querystring');

var client_id = config.id; // Your client id
var client_secret = config.secret; // Your secret
var redirect_uri = config.uri; // Your redirect uri

//Used for Favicon loading


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
   .use(cookieParser())
   .use(bodyParser.urlencoded({ extended: false }))
   .use(bodyParser.json())
   .use("/public", express.static('public')); 

//after you click the log in with spotify button
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

//after spotify authoizes user
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

          let playlistName = 'Latest ' + numSongs + ' Songs - ' + playlist
               var requestData = {
                 name: playlistName,
                 description: 'This playlist was created by LatestSongs'
               };
               request({ //sends spotify user data
                url: 'https://api.spotify.com/v1/users/' + userId + '/playlists',
                headers: { 'Authorization': 'Bearer ' + access_token },
                method: "POST",
                json: requestData
              }, function (error, response, body) {
                //console.log(body)
                existingPlaylistId = body.id
              });

          var getRequest = {
            url: 'https://api.spotify.com/v1/users/' + userId + '/playlists',
            headers: { 'Authorization': 'Bearer ' + access_token },
            json: true
          };
          //yoink user playlists
          request.get(getRequest, function (error, response, body) {
            //console.error('error:', error); // Print the error if one occurred
            //console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            //console.log('body:', body); // Print the HTML for the Google homepage. 
            var playlistId;
            items = body.items
            var length;
            
            for(var i = 0; i < items.length; i++)
            {
              if(items[i].name.toLowerCase() === playlist.toLowerCase()) {
                playlistId = items[i].id
                length = items[i].tracks.total
                playlist = items[i].name
              }
              // else if(items[i].name == 'Latest ' + numSongs + ' Songs - ' + playlist)
              // {
              //   playlistExists = true;
              //   existingPlaylistId = items[i].id;
              //   //console.log(existingPlaylistId)
              // }
            }
            if(false)//playlistExists == false)
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
            //console.log(playlistId)
            var getPlaylistItems = {
              url: 'https://api.spotify.com/v1/playlists/' + playlistId + '/tracks?offset=' + (length - numSongs),
              headers: { 'Authorization': 'Bearer ' + access_token },
              json: true
            };
            //gets the last few tracks of the playlist
            request.get(getPlaylistItems, function (error, response, body) {
              items = body.items
              //console.log(items)
              let tracks = new Array(numSongs)
              for(var i = 0; i < numSongs; i++)
              {
                tracks[i] = items[i].track.uri
              }
              //console.log(typeof(tracks[1]))
              
              tracks.reverse()
              //console.log('before')
              delay(10000)
              //console.log('after')
              //console.log(tracks)
              var requestData = {
                uris: tracks
              }
              //adds songs to the new playlist
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

app.route('/spotifyLogin')
  .get(function (req, res) {
    res.send('yep')
  })
  .post(function (req, res) {
    var options = {
      root: path.join(__dirname, '/public')
    };
    
    var fileName = 'spotifyLogin.html';
    res.sendFile(fileName, options, function (err) {
      if (err) {
          next(err);
      } else {
          //console.log('Sent:', fileName);
      }
    //console.log(req.body.name)  
    //console.log(req.body.number)  
    playlist = req.body.name
    numSongs = req.body.number
  });
  })

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
