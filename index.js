var SockJS = require('sockjs-client-node');
var fs = require('fs');
var pxxl = require('./pxxl/js/utils.js');

var NUM_MINIONS = 3;
var FLAG_HEIGHT = 22, FLAG_WIDTH = 40;
var minions = [];

var out = fs.createWriteStream('./log.txt');
var mouse_rate = 50;
var end = false;
var px = null;

pxxl('./pxxl/fonts/c64.bdf', 'Hello', function(text, pixels, font) {
    px = pixels;

    for (var i=0;i<NUM_MINIONS;i++) {
        var sjs = new SockJS('https://iic-sockets.herokuapp.com/christmas');
        sjs.minionNumber = i;
        sjs.onmessage = onMessage.bind(sjs);  
        if (i === (NUM_MINIONS-1)) {
            sjs.onopen = function() {
                sendFrame(0);
            }
        }

        minions.push(sjs);
    }

    setTimeout(function() { 
        end = true; 
        minions.forEach(function(m) { 
            m.close(); 
        }); 
    }, 10000);
});

function onMessage(e) {
    var data = JSON.parse(e.data);
    if (data && data.user && data.user.id) this.user_id = data.user.id;    
    if (data && data.live && data.live.mouse_rate) mouse_rate = parseInt(data.live.mouse_rate);
    if(this.minionNumber === 0) {  
        out.write(e.data + '\n');    
    }
};

function sendFrame(ticks) {
    var ms = (ticks * mouse_rate) % 1000;

    minions.forEach(function(m) {
        if (m.user_id && !end) {
            var rad = (2 * Math.PI * ms / 1000) + (((m.minionNumber + 1) / NUM_MINIONS) * Math.PI * 2);

            var msg = {
                x: Math.floor((Math.cos(rad) * 100)) + 300,
                y: Math.floor((Math.sin(rad) * 100)) + 300,
                id: m.user_id,
                c: "HK",
                _event: "motion"
            }
            m.send(JSON.stringify(msg));
            console.log('sending', JSON.stringify(msg));

            /*
            // ghosting
            msg._event = 'click';
            msg.button = 'right';
            sjs.send(JSON.stringify(msg));        
            */
        }
    });

    if (!end) {
        setTimeout(function() {
            sendFrame(ticks + 1);
        }, mouse_rate);
    }
}


