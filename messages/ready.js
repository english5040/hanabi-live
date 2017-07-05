'use strict';

// Sent when the user has joined a game and the UI has been initialized
// "data" is empty

// Imports
const globals = require('../globals');
const logger  = require('../logger');
const models  = require('../models');

// When the client has joined a game after they have initialized the UI
exports.step1 = function(socket, data) {
    // Local variables
    data.gameID = socket.atTable.id;

    if (socket.atTable.replay) {
        models.games.getActions(socket, data, step2);
    } else {
        data.game = globals.currentGames[data.gameID];
        step2(null, socket, data);
    }
};

function step2(error, socket, data) {
    if (error !== null) {
        logger.error('Error: models.games.getActions failed:', error);
        return;
    }

    let game = data.game;

    // Get the index of this player
    let index = -1; // Set an impossible index by default
    if (socket.atTable.replay === false) { // We only have to worry about getting the index if we need to scrub cards
        for (let i = 0; i < game.players.length; i++) {
            if (game.players[i].userID === socket.userID) {
                index = i;
                break;
            }
        }
    }

    // Send a "notify" or "message" message for every game action of the deal
    for (let action of game.actions) {
        // Scrub card info from cards if the card is in their own hand
        let scrubbed = false;
        let scrubbedAction;
        if (action.type === 'draw' && action.who === index) {
            scrubbed = true;
            scrubbedAction = JSON.parse(JSON.stringify(action));
            scrubbedAction.rank = undefined;
            scrubbedAction.suit = undefined;
        }

        socket.emit('message', {
            type: ('text' in action ? 'message' : 'notify'),
            resp: (scrubbed ? scrubbedAction : action),
        });
    }

    // If it is their turn, send an "action" message
    if (game.turn_player_index === index) {
        socket.emit('message', {
            type: 'action',
            resp: {
                can_clue: (game.clue_num > 0 ? true : false),
                can_discard: (game.clue_num < 8 ? true : false),
            },
        });
    }

    // Send an "advanced" message
    // (if this is not sent during a replay, the UI will look uninitialized)
    socket.emit('message', {
        type: 'advanced',
    });

    // Send them the current time for the clock
    if (game.timed) {
        let newClockTime = game.players[game.turn_player_index].time;
        socket.emit('message', {
            type: 'notify',
            resp: {
                type: 'clock',
                time: newClockTime,
                player: game.players[game.turn_player_index].username,
            },
        });
    }
}
