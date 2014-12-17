var SockJS = require('sockjs-client-node');
var fs = require('fs');
var pxxl = require('./pxxl/js/utils.js');

var NUM_MINIONS = 10;
var FLAG_HEIGHT = 22, FLAG_WIDTH = 40;
var minions = [];

var out = fs.createWriteStream('./log.txt');
var mouse_rate = 50;
var ghost_max = 10;
var ghost_duration = 0;
var end = false;
var px = null;


pxxl('./pxxl/fonts/tom-thumb.bdf', process.argv[2], function(text, pixels, font) {
    px = pixels;

    for (var i=0;i<NUM_MINIONS;i++) {
        var sjs = new SockJS('https://iic-sockets.herokuapp.com/christmas');
        sjs.minionNumber = i;
        sjs.ghosts = 0;
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
    if (data && data.live && data.live.ghost_max) ghost_max = parseInt(data.live.ghost_max);
    if (data && data.live && data.live.ghost_duration) ghost_duration = parseInt(data.live.ghost_duration);

    if(this.minionNumber === 0) {  
        out.write(e.data + '\n');    
    }
};

// @TODO: send minion frames in batches, leave ghosts
function sendFrame(ticks) {    
    var ms = (ticks * mouse_rate) % 1000;

    var advanceTick = 0;

    minions.forEach(function(m) {
        if (m.user_id && !end) {
            if (m.ghosts <= ghost_max) {
                advanceTick = 1;

                var pxindex = (ticks + m.minionNumber) % px.length;
                var msg = {
                    x: 300 + px[pxindex].x * FLAG_WIDTH,
                    y: 300 + px[pxindex].y * FLAG_HEIGHT,
                    id: m.user_id,
                    c: "HK",
                    _event: "motion"
                }
                m.send(JSON.stringify(msg));
                //console.log('sending', JSON.stringify(msg));

                // ghosting
                if (m.ghosts < ghost_max) {
                    msg._event = 'click';
                    msg.button = 'right';
                    m.send(JSON.stringify(msg));        
                    m.ghosts++;
                    setTimeout(function() {
                        m.ghosts--;
                    }, ghost_duration);
                }
            }            
        }
    });

    if (!end) {
        setTimeout(function() {
            sendFrame(ticks + advanceTick);
        }, mouse_rate);
    }
}


