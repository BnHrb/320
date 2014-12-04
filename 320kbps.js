var express = require('express');
var app = express();
var request = require('request');
var cheerio = require('cheerio');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');

var domain = 'http://mrtzc.ch';
var d_domain = 'http://d.mrtzc.ch';

app.set('port', (process.env.PORT || 1337))
.use(express.static(__dirname + '/public')) // public folder
.get('/', function(req, res){
	res.sendFile(__dirname + '/views/index.html');
	fs.appendFile('connection.log', req.ip+' | '+req.headers['user-agent']+'\n', function(err){
		if(err)
			console.log(err);
	});
});

io.sockets.on('connection', function(socket){ // open the socket
	app.on('create_link', function(link){ // for each new link created
		socket.emit('new_link', link); // send new link
	});
	socket.on('new_search', function(artist, song, pref){ // for each new research
		fs.appendFile('search.log', artist+' | '+song+' | '+pref+'\n', function(err){
			if(err)
				console.log(err);
		});
		createLinks(artist, song, pref);
	});
});

server.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
});


function createLinks(artist, song, pref){ 
	var url = domain+'/';
	if(artist != ''){
		url += artist.replace(/ |'/g, '_');
		if(song != '')
			url += '_';
	}
	if(song != '')
		url += song.replace(/ |'/g, '_');
	url += '_1s.html';

	//console.log('URL ==> '+url);
	
	request(url, function(error, response, body) {
		$ = cheerio.load(body);

		if($('#pagination .mp3Play').length == 0)
			app.emit('create_link', '<tr><td colspan="3" class="text-danger text-center">No file found</td></tr>');
		else if($('#sort a').length == 0){
			page($('#pagination .mp3Play'), pref);
		}
		else {
			$('#sort a').each(function(){
				pages = $(this).attr('onclick').split('\'');
				request.post(domain+'/pagechange.php', {form:{hash:pages[3], page:pages[1]}}, function(err, resp, body){
					page(cheerio.load(body)('.mp3Play'), pref);
				});
			});
		}
	});
}

function page(p, pref){

	var id, sec, title, time, pages;

	p.each(function(){
		id = $(this).find('.fileinfo script').text().match(/'[a-z0-9]*'/g);
		id = id[1].replace(/'/g, '');
		time = $(this).find('.fileinfo').text().split('show')[0];
		sec = time.match(/(\d+):(\d+)/);
		sec = +sec[1]*60+ +sec[2]; // string to seconds
		title = $(this).find('.mp3Title').attr('title');

		bitrate(id, sec, title, time, pref, function(data){
			if(data != '')
				app.emit('create_link', data); // when a new link is created
		});
	});
}

function bitrate(id, sec, title, time, pref, callback){
	request.post(domain+'/bitrateY.php', {form:{a:id}}, function(err, resp, body){
		if(err)
			console.log('Error bitrate:'+err);
		var reg = new RegExp("<[a-z/ ]*>|<[a-z]*>", "g");
		var rate = body.split(reg);
		rate = rate[0] == '' ? rate[1] : rate[0].replace('kbps', '');
		rate = Number(rate);

		var size = fileSize(rate, sec);
		if(rate >= Number(pref)){
			var c;
			if(rate > 256) // color code
				c = 'text-success';
			else if(rate > 128)
				c = 'text-warning';
			else
				c = 'text-danger';

			// send the link
			callback('<tr>'
				+'<td class="'+c+'">'+rate+' Kbit/s</td>'
				+'<td>'+time+'</td>'
				+'<td><a href="'+d_domain+'/get3.php?singer='+title.split('-')[0].replace(/ /g, '%20')+'&song='+title.split('-')[1].replace(/ /g, '%20')+'&size=%20'+size+'&ids='+createUrlId(id)+'">'+title+'</td>'
				+'<td><audio controls preload="none"><source src="'+d_domain+'/get3.php?singer='+title.split('-')[0].replace(/ /g, '%20')+'&song='+title.split('-')[1].replace(/ /g, '%20')+'&size=%20'+size+'&ids='+createUrlId(id)+'" type="audio/mp3">Your browser does not support the audio element.</audio></td>'
				+'</tr>');
		}
		else
			callback('');
	})
}

function createUrlId(id){
	var res = id;
	for(var i=0, len = res.length-8; i<len; i++) {
		if(res[i] == 'a')
			res = replaceAt(res, i, '0');
		else if(res[i] == 'b')
			res = replaceAt(res, i, 'a');
		else if(res[i] == '0')
			res = replaceAt(res, i, 'h');
		else if(res[i] == 'f')
			res = replaceAt(res, i, 'g');
		else if(res[i] == 'c')
			res = replaceAt(res, i, 's');
		else if(res[i] == 'e')
			res = replaceAt(res, i, 'f');
	}

	return res.substr(0, len);
}

function replaceAt(string, index, character) {
    return string.substr(0, index) + character + string.substr(index+character.length);
}

function fileSize(rate, sec){
	return (rate*1024*sec)/8;
}


