//dependencies for each module used
var express = require('express');
var http = require('http');
var path = require('path');
var handlebars = require('express3-handlebars');
var app = express();
//load environment variables
var dotenv = require('dotenv');
dotenv.load();

//fbgraph
var graph = require('fbgraph');

//twit
var twit = require('twit');

//twitter oauth
var passport = require('passport');
var util = require('util');
var passportTwitterStrategy = require('passport-twitter').Strategy;

//have two blank strings for access token and access secret
var accessToken = process.env.twitter_access_token;
var accessSecret = process.env.twitter_access_secret;
var twitterOauth = {
	consumer_key: process.env.twitter_client_id,
	consumer_secret: process.env.twitter_client_secret,
	access_token: accessToken,
	access_token_secret: accessSecret
};

//Set up passport session set up.
//This allows persistant login sessions so the user doesn't need to keep logging in everytime
//for their access token
passport.serializeUser(function(user, done) {
	done(null, user);
});

passport.deserializeUser(function(obj, done) {
	done(null, obj);
});

// Simple route middleware to ensure user is authenticated.
function ensureAuthenticated(req, res, next) {
	if (req.isAuthenticated()) { return next(); }
	res.redirect('/');
}


//Use TwitterStrategy with passport
passport.use(new passportTwitterStrategy({
	consumerKey: process.env.twitter_client_id,
	consumerSecret: process.env.twitter_client_secret,
	callbackURL: "http://localhost:3000/auth/twitter/callback"
}, function (token, tokenSecret, profile, done) {
	//setting up access token
	accessToken = token;
	accessSecret = tokenSecret;
	twitterOauth.access_token = token;
	twitterOauth.access_token_secret = tokenSecret;
	//Continuing on
	process.nextTick(function() {
		return done(null, profile);
	});
}));

//Configures the Template engine
app.engine('handlebars', handlebars());
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.bodyParser());
//more setting up configuration for express
//Allows cookie access and interaction
app.use(express.cookieParser() );
app.use(express.session({ secret: 'nyan cat'}));
//Intialize passport
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

//routes
app.get('/', function(req,res) { 
	res.render("index");
});
/*
//fbgraph authentication
app.get('/auth/facebook', function(req, res) {
	if (!req.query.code) {
		var authUrl = graph.getOauthUrl({
			'client_id': process.env.facebook_client_id,
			'redirect_uri': 'http://localhost:3000/auth/facebook',
			'scope': 'user_about_me'//you want to update scope to what you want in your app
		});

		if (!req.query.error) {
			res.redirect(authUrl);
		} else {
			res.send('access denied');
		}
		return;
	}
	graph.authorize({
		'client_id': process.env.facebook_client_id,
		'redirect_uri': 'http://localhost:3000/auth/facebook',
		'client_secret': process.env.facebook_client_secret,
		'code': req.query.code
	}, function( err, facebookRes) {
		res.redirect('/UserHasLoggedIn');
	});
});

app.get('/UserHasLoggedIn', function(req, res) {
	graph.get('me', function(err, response) {
		console.log(err); //if there is an error this will return a value
		data = { facebookData: response};
		res.render('facebook', data);
	});
});*/


//twitter authentication Oauth setup
//this will set up twitter oauth for any user not just one
app.get('/auth/twitter', passport.authenticate('twitter'), function(req, res) {
	//nothing here because callback redirects to /auth/twitter/callback
});

//callback. authenticates again and then goes to twitter
app.get('/auth/twitter/callback', 
	passport.authenticate('twitter', { failureRedirect: '/' }),
	function(req, res) {
		res.redirect('/twitter');
	});


app.get('/twitter', ensureAuthenticated, function(req, res) {
	//I can use twitterOauth as previously it's an array set up with the correcet information
	var T = new twit(twitterOauth); 
	T.get('search/tweets', { q: 'banana since:2011-11-11', count: 10 }, function(err, reply){
		console.log(err); //If there is an error this will return a value
		data = { twitterData: reply };
		res.render('twitter', data);
	});
});

app.get('/twitter/default', ensureAuthenticated, function(req, res) {
	//I can use twitterOauth as previously it's an array set up with the correcet information
	var date = new Date();
	var formattedDate = date.getFullYear() + "-" + (date.getMonth()+1) + "-" + date.getDate();
	//console.log(formattedDate);
	//how many minutes to search
	var timeLimit = 5;
	//figure out if the tweet is from the last 5 mins
	function tweetFromLastMinute(timeCreated, timeLimit){
		//expect timeCreated format to be "Thu Apr 24 23:04:47 +0000 2014"
		var firstColon = timeCreated.indexOf(':');
		var tweetHour = timeCreated.slice(firstColon-2,firstColon);
		var tweetMinute = timeCreated.slice(firstColon+1,firstColon+3);
		var tweetSecond = timeCreated.slice(firstColon+4,firstColon+6);

		var currentHour = date.getHours();
		var currentMinute = date.getMinutes();
		var currentSecond = date.getSeconds();

		if(tweetMinute >= (currentMinute - timeLimit) && tweetMinute <= currentMinute 				
			|| tweetMinute%60 < timeLimit && currentMinute <= timeLimit - tweetMinute%60){	//if the hour changed
			return true;
		}
		return false;
	};

	var hashtagData = new Array();
	var hashtags = ["#compassion", "#angry", "#creative", "#b1a4", "#2ne1"]; 
	var T = new twit(twitterOauth);
	function searchHashtags(i){
		if(i < hashtags.length){
			T.get('search/tweets', { q: hashtags[i]+' since:'+formattedDate, count: 100 }, function(err, reply){
				console.log("error: "+err); //If there is an error this will return a value
				
				//loop through all statuses to find those from last 5 mins
				var count = 0;
				for(var j = 0; j < reply.statuses.length; j++){
					var timeCreated = reply.statuses[j].created_at;
					if(tweetFromLastMinute(timeCreated, timeLimit)){
						count++;
					}
				}
				console.log("how many tweets for "+ hashtags[i] +" from last 5 minutes?");
				console.log(count);

				hashtagData.push({name: hashtags[i], size: count});
				console.log("data inside T.get:");
				console.log(hashtagData);
				if ((i+1) == hashtags.length) {
					console.log("data outside T.get:");
					console.log(hashtagData);
					var hashtagData2 = {name: "emotions", children: hashtagData};
					res.json(hashtagData2);
				}
			});
			searchHashtags(i+1);
		}
	};

	//start searching hashtags with index 0
	searchHashtags(0);
});



//set environment ports and start application
app.set('port', process.env.PORT || 3000);
http.createServer(app).listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
});