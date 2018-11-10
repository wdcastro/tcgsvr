var express = require('express');
var mongoclient = require('mongodb').MongoClient;
var mongourl = "mongodb://localhost:27017/";
var dbname = "tcgdb";
var db;

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var games = require('./gameitems.js');

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

var port = process.env.PORT || 8080;
var router = express.Router();

var sessionTimers = {};

function getCodes(i){
  switch (i){
    case "200":
    return { code: "200", status:"OK" };
    case "401":
    return { code: "401", status:"Forbidden" };
    default:
    return { code: "404", status:"Not Found" };
  }
}

//ROUTES ENDPOINTS
router.get('/', function(req, res){
  res.json({message: 'reached api'});

});

router.get('/game/:id', function(req, res){
  res.json({message: 'requesting id '+req.params.id});

});

router.post('/login', function(req, res){
  var data = req.body;
  //compute things
  res.sendStatus(200);
  //res.sendStatus(401);

});

//WEBSOCKETS
io.sockets.on('connection', function(socket){

  socket.on('subscribe', function(room){
    console.log('joining room '+room);
    socket.join(room);
  });

  socket.on('unsubscribe', function(room){
      console.log('leaving room '+room);
      socket.leave(room);
    });

  socket.on('action', (message) => checkValidAction(message, socket));

  socket.on('end turn', message => endTurn(message, socket));

  socket.on('new session', message => newSession(message,socket.id));

  socket.on('join session', message => joinSession(message,socket.id));

  socket.on('start session', message => startSession(message,socket.id));

  socket.on('stop timer', message => stopTimer(message,socket.id));
});

function stopTimer(message, socketid){
  console.log("timer stopping");
  console.log(message.sessionID);
  console.log(sessionTimers);

  var session = games.newSession(message.sessionID);
  clearTimeout(sessionTimers[message.sessionID]);
  console.log(session);
  saveSession(session);

}

//SESSION ACTIONS
function newSession(message, socketid){
  var session = games.newSession(message.sessionID);
  if(session.gameState.socketIds.indexOf(socketid) == -1){
    session.gameState.socketIds.push(socketid);
    session.gameState.turnOrder.push(message.name);
    session.field.decks.push(games.getSampleDeckA());
    session.field.activecards.push([]);
    session.field.discardpile.push([]);
    session.field.defensezone.push([]);
    session.field.hands.push([]);
    session.field.buffs.push([]);
    session.field.actioncounts.push(5);
    session.field.charactercards.push(games.newCharacterCard());
    session.field.weapons.push(games.newWeaponCard());
    session.field.hp.push(10);
    var gameticket = games.newGameTicket(session.gameState.sessionID, session.gameState.socketIds.length-1);
    session.gameTickets.push(gameticket);
    io.to(socketid).emit('game ticket',gameticket);
  }
  console.log("creating new session: "+session.gameState.sessionID);
  sendGameStateInfo(session);
  saveSession(session);
}

function saveSession(session){
  console.log("save session");
  db.collection('sessions').updateOne({"sessionID": session.gameState.sessionID}, {$set: {session}}, {upsert:true}, function(err,r){
    if(err) {
      console.log(err);
    } else {
    }
  });
}

/*




db.collection('sessions').find({sessionID:message.sessionID}).limit(1).toArray(function(err, r) {
  if(err) {
    console.log(err);
  } else {
    var session = r[0].session;

  }
});
*/
function joinSession(message, socketid){
  db.collection('sessions').find({sessionID:message.sessionID}).limit(1).toArray(function(err, r) {
    if(err) {
      console.log(err);
    } else {
      var session = r[0].session;
      if(session.gameState.socketIds.indexOf(socketid) == -1){
        session.gameState.socketIds.push(socketid);
        session.gameState.turnOrder.push(message.name);
        session.field.decks.push(games.getSampleDeckA());
        session.field.activecards.push([]);
        session.field.discardpile.push([]);
        session.field.defensezone.push([]);
        session.field.hands.push([]);
        session.field.buffs.push([]);
        session.field.actioncounts.push(5);
        session.field.charactercards.push(games.newCharacterCard());
        session.field.weapons.push(games.newWeaponCard());
        session.field.hp.push(10);
        var gameticket = games.newGameTicket(session.gameState.sessionID, session.gameState.socketIds.length-1);
        session.gameTickets.push(gameticket);
        io.to(socketid).emit('game ticket',gameticket);
      }
      console.log("joining session: "+session.gameState.sessionID);
      io.to(session.gameState.sessionID).emit('game state',session.gameState);
      saveSession(session);
    }
  });

}

function startSession(message, socketid){
  //get all player decks
  //decide turn order
  //deal cards
  //set up session object
  db.collection('sessions').find({sessionID:message.sessionID}).limit(1).toArray(function(err, r) {
    if(err) {
      console.log(err);
    } else {
      var session = r[0].session;
      io.to(message.sessionID).emit('session start', session.gameState);
      saveSession(session);
      sendFieldInfo(session);
      nextTurn(message.sessionID);
    }
  });

}

function sendFieldInfo(session){
  for(var i = 0; i < session.gameState.socketIds.length; i++){
    var field = session.field;
    field = games.parseHidden(field, i);
    io.to(session.gameState.socketIds[i]).emit('your field',field);
    console.log("emitting to "+session.gameState.socketIds[i]+" about your field");
  }
}

function sendGameStateInfo(session){
  io.to(session.gameState.sessionID).emit('game state',session.gameState);
}

function dealCard(session, playertodeal, qty){
  if(session.field.decks[playertodeal].length > 0){
    var cardstodeal = session.field.decks[playertodeal].splice(0,qty);
    for(let card of cardstodeal){
      session.field.hands[playertodeal].push(card);
    }
  } else {
    console.log("out of cards for player "+playertodeal);
  }

  return session;
}

//CHECK ACTION VALIDITY
function checkValidAction(action, socket){
  console.log("play card");
  db.collection('sessions').find({sessionID:action.sessionID}).limit(1).toArray(function(err, r) {
    if(err) {
      console.log(err);
    } else {
      var session = r[0].session;
      var cardtoplay;
      switch (action.location){
      case 'hand':
      if(action.playerindex == session.gameState.turnPlayer){
        console.log('its my turn');
        cardtoplay = session.field.hands[action.playerindex][action.cardindex];
        if(cardtoplay == null){
          console.log("sent a request for nonexistent card");
          break;
        }
        if(session.field.actioncounts[action.playerindex] >= cardtoplay.actionCost){ //check action cost
          console.log('i have enough actions');
          session.field.hands[action.playerindex].splice(action.cardindex,1)[0];
          session.field.actioncounts[action.playerindex] -= cardtoplay.actionCost;
          switch(cardtoplay.type){
          case 'action':
          //move to active area
          console.log('played an action card');
          session.field.activecards[action.playerindex].push(cardtoplay);
          activateEffects(session,cardtoplay, action.playerindex, 0);
          //apply effects
          break;
          case 'defense':
          if(session.field.defensezone[action.playerindex].length < 4){
            session.field.defensezone[action.playerindex].push(cardtoplay);
          } else {
            socket.emit("declined","maximum defense reached");
          }
          //move to defense area
          break;
          case 'weapon':
          session.field.weapons[action.playerindex] = cardtoplay;
          break;
          }
        }

      } else {
        console.log("not your turn yet");
      }

      break;
      case 'defense':
      //TODO this takes turn into account when playing defense
      cardtoplay = session.field.defensezone[action.playerindex][action.cardindex];
      if(session.field.actioncounts[action.playerindex] >= cardtoplay.actionCost){
        session.field.defensezone[action.playerindex].splice(action.cardindex,1)[0];
      //activate effect cardtoplay
        session.field.discardpile[action.playerindex].push(cardtoplay);
      }
      break;
      case 'weapon':
      cardtoplay = session.field.weapons[action.playerindex];
      //activate card to player
      break;
      }
      checkWinCondition(session);
      sendFieldInfo(session);
      saveSession(session);


    //check action points, card conditions
    //reply ok or not
    //broadcast to other players
    //move card to places
    //io.to('abcd').emit('action', action); //animations, flames magic etc,
    //apply card effects()
    //endturn
    }
  });

}

function activateEffects(session, cardtoplay, activatedby, target){
  //lose hp

  console.log("playing "+cardtoplay.name+" cast by "+activatedby+" aimed at "+target);
  var effects = cardtoplay.effect;
  for(let effect of effects){
    switch(effect.type){
      case 'damage':
      session.field.hp[target]-=effect.qty;
      console.log('dealing damage' + effect.qty);
      askForSelection(session, activatedby, 'attack');
      break;
    }
  }
  //sendFieldInfo(session);
  //saveSession(session);
  //DO I REALLY NEED THIS
  //lose mana
  //lose cards
  //draw cards
  //check for win condition
}

function setAllSelectableFalse(session){

}

function askForSelection(session, playerToAsk, selectionType){
  console.log("askForSelection");
  console.log(selectionType);
  switch(selectionType){
    case 'attack':
    console.log("inside attack");
    io.to(session.gameState.socketIds[playerToAsk]).emit('selection','attack');
    console.log(session);
    for(var i = 0; i< session.field.charactercards.length; i++){ //set characters selectable
      console.log("inside character cards loop");
      console.log("loooking at "+session.field.charactercards[i].name);
      if(i != playerToAsk){
        session.field.charactercards[i].isSelectable = true;
      } else {
        console.log(i);
        console.log(playerToAsk);
      }
    }
    console.log("------------------------------");

    for(var i = 0; i< session.field.activecards.length; i++){ //set activezone selectable
      if(i != playerToAsk){
        for(var j = 0; j < session.field.activecards[i]; j++){ //for each card
          //check for type
          //if type()
          session.field.activecards[i][j].isSelectable = true;
        }
      }
    }
    //form an array and select
/*
what can i attack
enemy
enemy summon

what can i destroy
enemy active cards
enemy defense cards
enemy weapon
enemy summons

what can i bounce
enemy active cards - highlighting cards
enemy defense cards - highlighting cards
enemy weapons
enemy summons - wihtout untargetable effects

what can i search from deck
cards with <tag> - presenting choice array


function to parse if selectable? parse it here
create a field with selections offered - done this
front end should be in select mode, or add a gamestate that shows it is selecting - don't need a state
card.isSelectable = true for those sleecting can modify sendFieldInfo - just need to send field info here
*/

    sendFieldInfo(session);
    //ask for selection
    //selectio ncomes i through socket
    //remember what the selection is for
    //use selection and execute effect
/*
some changes to timer so it doesnt end turn ... or can it end turn

send selectable info?
emit "player x is selecting", to show graphical on other players

*/
    break;
  }
}

function checkWinCondition(session){
  //return false;
  //if (true){ endGame(winner) };
  for(let playerhp of session.field.hp){
    if(playerhp <= 0){
      console.log("Player hp is at 0");
      endGame();
    }
  }

}

function endGame(session){
  clearTimeout(session.gameState.turnEndTimeout);
}

function endTurn(session){
  //apply debuff effects
  if(session.field.hands[session.gameState.turnPlayer].length > 4){
    console.log("need to discard");
  }
  nextTurn(session.gameState.sessionID);
}

//GAME STATES
function nextTurn(sessionID){
  console.log("going to next turn");
  db.collection('sessions').find({sessionID:sessionID}).limit(1).toArray(function(err, r) {
    if(err) {
      console.log(err);
    } else {
      var session = r[0].session;
      if(session.gameState.turnCount != 0) {
        if(session.gameState.turnPlayer == session.gameState.turnOrder.length-1){
          session.gameState.turnPlayer = 0;
        } else {
          session.gameState.turnPlayer++;
        }
      } else {
        //first turn
        for(var i = 0;i<session.gameState.turnOrder.length; i++){
          console.log("dealing 3 to "+i);
          session = dealCard(session, i, 3);
        }

      }

      session.gameState.turnCount++;
      //console.log(session);

      session = dealCard(session, session.gameState.turnPlayer, 1);

      //send correct socket the authority
      io.to(session.gameState.sessionID).emit('new turn', session.gameState);
      console.log("emitting new turn "+session.gameState.turnPlayer);

      //wait for action. start timer on timer endturn();
      //session.gameState.turnEndTimeout = setTimeout(endTurn,10000,session);
      sessionTimers[session.gameState.sessionID] = setTimeout(endTurn,10000,session);

      saveSession(session);
      sendFieldInfo(session);
      sendGameStateInfo(session);
    }
  });

}

//START SERVER

router.all('*');
app.use('/',router);
mongoclient.connect(mongourl, function(err,client){
  console.log("connected to mongodb");
  if(err){
    throw err;
  }
  db = client.db(dbname);
  http.listen(port, () => {
        console.log('REST started on port '+port);
  });
});
