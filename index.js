var SockJS = require('sockjs-client-node');
var fs = require('fs');

// CONFIGURE THIS
var NUM_MINIONS = 10;
var DURATION = 3000;

// DON'T CONFIGURE THIS
var FLAG_HEIGHT = 22, FLAG_WIDTH = 40;
var minions = [];
var out = fs.createWriteStream('./log.txt');
var mouse_rate = 50;
var ghost_max = 10;
var ghost_duration = 0;
var end = false;
var px = null;

var xoffset = Math.floor(Math.random() * 800);
var yoffset = Math.floor(Math.random() * 600);

var alphabet = {};
var alpha_meta = {};
var full_alphabet = "abcdefghijklmnopqrstuvwxyz";
for(var i=0; i<full_alphabet.length; i++) {
    alphabet[full_alphabet[i]] = require('./alphabet/' + full_alphabet[i] + '.json');    
    alpha_meta[full_alphabet[i]] = new Object();
}
Object.keys(alphabet).forEach(function(letter) {
    var max_x = 0, min_x = 9999, max_y = 0, min_y = 9999;
    alphabet[letter].forEach(function(e) {
        if(e._event==='click') {
            max_x = Math.max(parseInt(e.x), max_x);
            min_x = Math.min(parseInt(e.x), min_x);
            max_y = Math.max(parseInt(e.y), max_y);
            min_y = Math.min(parseInt(e.y), min_y);        
        }
    });

    // offset everything from zero
    alphabet[letter].forEach(function(e, i) {
        if(e._event==='click') {
            alphabet[letter][i].x = alphabet[letter][i].x - min_x;
            alphabet[letter][i].y = alphabet[letter][i].y - min_y;
        }
    });

    alpha_meta[letter].width = max_x - min_x;
    alpha_meta[letter].height = max_y - min_y;    
});

// vertically center letters
var tallest_letter = 0;
Object.keys(alpha_meta).forEach(function(letter) {
    tallest_letter = Math.max(alpha_meta[letter].height);
});
Object.keys(alphabet).forEach(function(letter) {
    alphabet[letter] = alphabet[letter].map(function(command) {
        if(command._event === 'click') {
            command.y += Math.floor((tallest_letter - alpha_meta[letter].height) / 2);
        }
        return command;
    });
});


function MakeLetterCommands(string, callback) {
    var commands = [];
    string = string.toLowerCase();
    var offset = 0;
    for(var i=0;i<string.length;i++) {
        if (string[i]===' ') {
            offset += 50;
        }
        else {
            var letter = JSON.parse(JSON.stringify(alphabet[string[i]]));
            var meta = alpha_meta[string[i]];

            for(var j=0;j<letter.length;j++) {
                if (letter[j]._event==='click') {
                    letter[j].x = letter[j].x + offset;
                }
                commands.push(letter[j]);                
            }

            offset += meta.width + 30;
        }
    }
    callback(commands);
}


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

function sendFrame(ticks) {    
    var ms = (ticks * mouse_rate) % 1000;
    var advanceTick = 0;

    minions.forEach(function(m) {
        if (m.user_id && !end) {
            if (m.ghosts <= ghost_max) {
                advanceTick = 1;
            
                var stepIndex = (((ticks * NUM_MINIONS) + m.minionNumber) % (instructions.length / 2)) * 2;

                var command_a = instructions[stepIndex];
                var command_b = instructions[stepIndex + 1];

                var msg = {};
                if (command_a._event==='scroll') {
                    msg = {
                        _event: 'scroll',
                        id: m.user_id,
                        angle: command_a.angle
                    };
                    m.send(JSON.stringify(msg));                    
                }
                setTimeout(function() {
                    if (command_b._event==='click') {
                    
                        if (m.ghosts <= ghost_max) {
                            msg = {
                                _event: 'motion',
                                c: (((stepIndex / 2) % 2) === 0) ? 'SA': 'MA',
                                x: xoffset + command_b.x,
                                y: yoffset + command_b.y,
                                id: m.user_id
                            };
                            m.send(JSON.stringify(msg));
                        }
                        if (m.ghosts < ghost_max) {
                            msg = {
                                _event: 'click',
                                button: 'right',
                                x: xoffset + command_b.x,
                                y: yoffset + command_b.y,
                                id: m.user_id
                            };
                            m.send(JSON.stringify(msg));
                        }
                    }
                }, mouse_rate);
            }            
        }
    });

    if (!end) {
        setTimeout(function() {
            sendFrame(ticks + advanceTick);
        }, mouse_rate * 2);
    }
}


var instructions;
MakeLetterCommands(process.argv[2], function(inst) {
    instructions = inst;
    for (var i=0; i<NUM_MINIONS; i++) {
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
    }, DURATION);
});