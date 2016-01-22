// Require required stuff
var spark = require('spark'),
    IS    = require('initial-state');


// Required variables
var ACCESS_TOKEN = (process.env.ACCESS_TOKEN ? process.env.ACCESS_TOKEN : '').trim();
var IS_TOKEN = (process.env.IS_TOKEN ? process.env.IS_TOKEN : '').trim();


// Optional variables
var EVENT_NAME = (process.env.EVENT_NAME ? process.env.EVENT_NAME : 'initialstate');
var FORWARD_SPARK = (process.env.FORWARD_SPARK ? process.env.FORWARD_SPARK : 0);
var SPARK_PATH = (process.env.SPARK_PATH ? process.env.SPARK_PATH : 'spark');
var IS_BUCKET = (process.env.IS_BUCKET ? process.env.IS_BUCKET : 'particle');


// I said it was required!
if(ACCESS_TOKEN.length==0) {
	console.error('You MUST provide a Particle access token');
	process.exit(1);
}


// I said it was required!
if(IS_TOKEN.length==0) {
	console.error('You MUST provide an Initial State access token');
	process.exit(1);
}


// Login to the cloud
spark.login({accessToken: ACCESS_TOKEN}, function() {
	subscribe_event();
	subscribe_spark();
});


// Bukkit!
var bukkit = IS.bucket(IS_BUCKET, IS_TOKEN);


// Subscription handler
function subscribe_event() {
	console.time('subscribe');
	_log('subscription started');

	// Subscribe
	var req = spark.getEventStream(EVENT_NAME, 'mine', function(data) {
		stats_parse(data);
	});

	// Re-subscribe
	req.on('end', function() {
		_log('subscription ended');
		console.time('subscribe');

		// Re-subscribe in 1 second
		setTimeout(subscribe_event, 1000);
	});
}


function subscribe_spark() {
	// Exit early if disabled
	if(FORWARD_SPARK!=1) return;

	console.time('spark_subscribe');
	_log('spark subscription started');

	// Subscribe
	var req = spark.getEventStream('spark', 'mine', function(data) {
		spark_parse(data);
	});

	// Re-subscribe
	req.on('end', function() {
		_log('spark subscription ended');
		console.time('spark_subscribe');

		// Re-subscribe in 1 second
		setTimeout(subscribe_spark, 1000);
	});
}


// Parse the data from the event
function stats_parse(data) {
	var msg, device_name;
	
	_log('>>>', data);

	// If a semi-colon exists, treat the string before it as the device name	
	if(data.data.indexOf(';')>0) {
		var semicolon_split = data.data.split(';');
		device_name = semicolon_split[0];
		data.data = semicolon_split[1];

	// If no custom device name, use the coreid instead
	} else
		device_name = data.coreid;
	
	// Check for the presence of a comma to see if we have multiple metrics in this payload
	// No comma = 1 metric
	if(data.data.indexOf(',')<0) {
		stats_send(device_name+'.'+data.data);

	// Commas = multiple metrics
	} else {
		// Split metrics into an array
		var data_arr = data.data.split(',');

		// Loop through the array and send the metrics		
		for(var i=0; i<data_arr.length; i++)
			stats_send(device_name+'.'+data_arr[i]);
	}
}


// Parse spark event data
function spark_parse(data) {
	_log('>>>', data);
	var path = data.name.replace('\/', '.');

	stats_send(SPARK_PATH+'.'+data.coreid+'.'+path+'.'+data.data+':1|c');
}


// Send the parsed metrics to StatsD
function stats_send(msg) {
	// Splits "overwinter1.h:34.37|g" into "overwinter1.h", "34.37|g"
	var a = msg.split(':');

	// Splits "34.37|g" into "34.37", "g"
	var b = a[1].split('|');

	// Friendly variable names
	var key = a[0];
	var val = b[0];

	// Send to Initial State
	bukkit.push(key, val);
	_log('<<<', [key, val].toString());

//	msg = new Buffer(msg);
//	udp.send(msg, 0, msg.length, STATSD_PORT, STATSD_HOST);
//	_log('<<<', msg.toString());
}


// Semi-fancy logging with timestamps
function _log() {
	var d = new Date();

	// Year
	d_str = d.getFullYear();
	d_str += '-';

	// Month
	if(d.getMonth()+1<10) d_str += '0';
	d_str += (d.getMonth()+1);
	d_str += '-';

	// Day
	if(d.getDate()<10) d_str += '0';
	d_str += d.getDate();
	d_str += ' ';

	// Hour
	if(d.getHours()<10) d_str += '0';
	d_str += d.getHours();
	d_str += ':';

	// Minute
	if(d.getMinutes()<10) d_str += '0';
	d_str += d.getMinutes();
	d_str += ':';

	// Second
	if(d.getSeconds()<10) d_str += '0';
	d_str += d.getSeconds();
	d_str += '.';

	// Milliseconds
	d_str += d.getMilliseconds();


	if(arguments.length==1)
		var l = arguments[0];
	else {
		var l = [];
		for(var i=0; i<arguments.length; i++)
			l.push(arguments[i]);
	}
			

	console.log('['+d_str+']', l);
}
