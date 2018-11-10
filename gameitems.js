exports.newSession = function(sessionID){
  return {
    gameTickets:[],
    gameState:{
      sessionID:sessionID,
      turnCount:0,
      turnPlayer:0,
      turnOrder:[],
      socketIds:[],
      turnEndTimeout: null,
      awaitingSelections:[]
    },
    field: {
      decks:[],
      activecards:[],
      discardpile:[],
      defensezone:[],
      hands:[],
      buffs:[],
      actioncounts:[],
      charactercards:[],
      weapons:[],
      hp:[]
    }
  };
}

exports.newGameTicket = newGameTicket;
exports.newCard = newCard;
exports.newHiddenCard = newHiddenCard;
exports.newCharacterCard = newCharacterCard;
exports.newWeaponCard = newWeaponCard;
exports.getSampleDeckA = getSampleDeckA;

function newGameTicket(sessionID, turnIndex){
  return {
    sessionID: sessionID,
    turnIndex: turnIndex,
  }
}



function getSampleDeckA(){

  return [newCard(),newWeaponCard(), newDefenseCard(), newDefenseCard(),newCard(),newCard(),newDefenseCard(),newWeaponCard()];

}

function getSampleDeckB(){
  return [newHighCostCard(),newCard(), newDefenseCard(),newCard(),newDefenseCard(),newCard(),newDefenseCard(),newWeaponCard()];
}

function newCharacterCard(){
  return {
    name: 'Character Card',
    description:'Blank character card',
    type:"character",
    effect:[],
    isSelectable: false
    //image:"./xxx.jpg"
  }
}

function newCard(){
  return {
    name:"Sample Card",
    description:"Blank template",
    effect:[newDamageEffect()],
    type:"action",
    actionCost: 1,
    isSelectable: false
    //revealed:"false"
  };
}

function newDamageEffect(){
  return {
    type: 'damage',
    qty: 1
  }
}

function newHighCostCard(){
  return {
    name:"Sample High Cost Card",
    description:"Blank template",
    effect:[],
    type:"action",
    actionCost: 3,
    isSelectable: false
    //revealed:"false"
  };
}

function newDefenseCard(){
  return {
    name:"Sample Defense Card",
    description:"Blank template",
    effect:[],
    type:"defense",
    actionCost: 1,
    isSelectable: false
  };
}

function newWeaponCard(){
  return {
    name:"Sample Weapon Card",
    description:"Blank template",
    effect:[],
    type:"weapon",
    actionCost: 1,
    isSelectable: false
  };
}

function newSummonCard(){
  return {
    name:"Sample Summon Card",
    description:"Blank template",
    effect:[],
    type:"summon",
    actionCost: 1,
    isSelectable: false
  };
}

function newEmptyCard(){
  return {
    name:"No Card",
    description:"Blank template",
    effect:[],
    type:"nocard",
    actionCost: 0,
    isSelectable: false
  };
}

function newHiddenCard(){
  return {
    name:"Unknown Card",
    description:"",
    effect:[],
    type:"unknown",
    actionCost: 0,
    isSelectable: false
  };
}


exports.parseHidden = function(field, index){

  var hiddencard = newHiddenCard();
  var newField = {
    decks:[[],[]],
    activecards:[[],[]],
    discardpile:[[],[]],
    defensezone:[[],[]],
    hands:[[],[]],
    buffs:[],
    actioncounts:[],
    charactercards:[],
    weapons:[],
    hp:[]
  };

  //DECKS
  for(var i = 0; i < field.decks.length; i++){
    var newdeck = [];
    for(var j=0; j<field.decks[i].length; j++){
      newdeck.push(hiddencard);
    }
    newField.decks[i] = newdeck;
  }


  //HANDS
  for(var i = 0; i < field.hands.length; i++){ //for each hands
    //if this is my hjand, skip it
      for(var j=0; j<field.hands[i].length; j++){
        if(i != index){
          newField.hands[i][j]=hiddencard;
        } else {
          newField.hands[i][j] = field.hands[i][j];
        }
      }


  }

  //DEFENSE ZONE
  for(var i = 0; i < field.defensezone.length; i++){ //for each defensezone
    //if this is my defensezone, skip it
      for(var j=0; j<field.defensezone[i].length; j++){
        if(i != index){
        newField.defensezone[i][j]=hiddencard;
        } else {
          newField.defensezone[i][j] = field.defensezone[i][j];
        }
      }

  }

  newField.activecards = field.activecards;
  newField.buffs = field.buffs;
  newField.actioncounts = field.actioncounts;
  newField.charactercards = field.charactercards;
  newField.weapons = field.weapons;
  newField.hp = field.hp;
  newField.discardpile = field.discardpile;

  return newField;
}
