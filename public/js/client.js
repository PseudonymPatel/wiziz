var inventoryDiv = document.querySelector('#inventory');
var storageDiv = document.querySelector('#storage');
var spellWrapper = document.querySelector('#spellWrapper');
var storageWrapper = document.querySelector('#storageWrapper');
var gameCanvas = document.querySelector('#gameCanvas');
var mainScreen = document.querySelector('#mainScreen');
var playButton = document.querySelector('#playButton');
var nicknameInput = document.querySelector('#nicknameInput');
var healthBar = document.querySelector('#health');
var xpBar = document.querySelector('#xp');
var gameScreen = document.querySelector('#game');
var levelNumberDisplay = document.querySelector('#levelNumberDisplay');
var xpNumberDisplay = document.querySelector('#xpNumberDisplay');
var healthPercentDisplay = document.querySelector('#healthPercentDisplay');
var chooseUnlockedSpells = document.querySelector('#chooseUnlockedSpells');
var chooseUnlockedSpellsWrapper = document.querySelector('#chooseUnlockedSpellsWrapper');

onbeforeunload = function() {
  if (state === 'playing') {
    return ('You are still alive! Are you sure you want to leave?');
  }
};

addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key === '-') {
    e.preventDefault();
  }
});

nicknameInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    playButton.click();
  }
});

var ctx = gameCanvas.getContext('2d');

var game = {};
state = 'fresh';
var player = {};
var inputs = [];
var sprites = {
  players: {
    red: createSprite('media/images/playerRed.png'),
    green: createSprite('media/images/playerGreen.png'),
    blue: createSprite('media/images/playerBlue.png')
  },
  src: {
    fireSpell: 'media/images/fireSpell.png',
    freezeSpell: 'media/images/freezeSpell.png',
    blindSpell: 'media/images/blindSpell.png',
    healSpell: 'media/images/healSpell.png',
    bombSpell: 'media/images/bombSpell.png',
    openStorage: 'media/images/openStorage.png'
  },
  effects: {
    fireSpell: createSprite('media/images/fireEffect.png'),
    freezeSpell: createSprite('media/images/freezeEffect.png'),
    healSpell: createSprite('media/images/healEffect.png'),
    bombSpell: createSprite('media/images/bombEffect.png'),
    blindSpell: createSprite('media/images/blindEffect.png'),
  }
};
var sounds = {
  fireSpell: createSound('media/sounds/fireSpell.mp3', 'media/sounds/fireSpell.ogg'),
  freezeSpell: createSound('media/sounds/freezeSpell.mp3', 'media/sounds/freezeSpell.ogg'),
  healSpell: createSound('media/sounds/healSpell.mp3', 'media/sounds/healSpell.ogg'),
  bombSpell: createSound('media/sounds/bombSpell.mp3', 'media/sounds/bombSpell.ogg'),
  blindSpell: createSound('media/sounds/blindSpell.mp3', 'media/sounds/blindSpell.ogg')
};
var local = {
  facing: {
    x: 0,
    y: 0
  },
  startingInventory: [{
    itemName: 'fireSpell',
    coolDown: 700
  }],
  lastPlayerStates: [],
  quedInputs: [],
  savedInputs: [],
  chosingUnlock: false,
  lastChosenUnlock: 1,
  inputNumber: 0,
  player: {},
  lastUpdate: 0,
  controls: {
    w: 'u',
    s: 'd',
    a: 'l',
    d: 'r'
  },
  keymap: {
    e: 'toggleStorage'
  },
  movement: {
    u: false,
    d: false,
    l: false,
    r: false
  }
};

function createSprite(src) {
  var sprite = document.createElement('img');
  sprite.src = src;
  return (sprite);
}

function createSound(mp3Src, oggSrc) {
  var sound = document.createElement('audio');
  var mp3 = document.createElement('source');
  var ogg = document.createElement('source');
  mp3.type = 'audio/mp3';
  ogg.type = 'audio/ogg';
  mp3.src = mp3Src;
  ogg.src = oggSrc;
  sound.appendChild(mp3);
  sound.appendChild(ogg);
  return (sound);
}

function localCoords(real, xOrY) {
  if (xOrY === 'x') {
    return (real + innerWidth / 2 - local.player.x);
  }

  if (xOrY === 'y') {
    return (real + innerHeight / 2 - local.player.y);
  }
}

function globalCoords(localCoord, xOrY) {
  if (xOrY === 'x') {
    return (localCoord - innerWidth / 2 + local.player.x);
  }

  if (xOrY === 'y') {
    return (localCoord - innerHeight / 2 + local.player.y);
  }
}

var socket = io.connect('/');

gameCanvas.width = innerWidth;
gameCanvas.height = innerHeight;

addEventListener('resize', function() {
  gameCanvas.width = innerWidth;
  gameCanvas.height = innerHeight;
});

socket.on('youDied', function() {
  state = 'dead';
  mainScreen.style.display = '';
  mainScreen.style.animationName = '';
  mainScreen.style.animationName = 'death';
});

socket.on('update', function(updatedGame) {
  if (game.players) {
    local.lastPlayerStates = JSON.parse(JSON.stringify(game.players));
  }

  game = updatedGame;
  local.lastUpdate = Date.now();

  if (game.players.find(function(element) {
      return (element.id === socket.id);
    })) {
    player = game.players.find(function(element) {
      return (element.id === socket.id);
    });
  }

  if (player.inventory) {
    fillInventory(player.inventory);
    document.querySelector('#inventorySlot' + (player.selectedItem + 1)).src = document.querySelector('#inventorySlot' + (player.selectedItem + 1)).src.replace('.png', 'Selected.png');
  }

  if (player.storage) {
    fillStorage(player.storage);
  }

  if (game.leaderboard) {
    updateLeaderboard(game.leaderboard);
  }

  var indexOfLastInput = local.savedInputs.indexOf(local.savedInputs.find(function(element) {
    return (element.id === player.lastInput);
  }));

  if (indexOfLastInput) {
    local.savedInputs.splice(0, indexOfLastInput + 1);
  }
});

onload = function() {
  playButton.addEventListener('click', function() {
    var playerOptions = {
      nickname: nicknameInput.value
    };
    local.movement = {
      u: false,
      d: false,
      l: false,
      r: false
    };
    socket.emit('newGame', playerOptions);
    fillInventory();
    fillInventory(local.startingInventory);

    mainScreen.style.display = 'none';
    local.lastTime = performance.now();
    requestAnimationFrame(drawLoop);
    state = 'playing';
  })
};

function fillInventory(inventory) {
  if (!inventory) {
    spellWrapper.innerHTML = '';
    for (var i = 0; i < 4; i++) {
      var coolDownDisplay = document.createElement('div');
      coolDownDisplay.className = 'coolDownDisplay';
      coolDownDisplay.id = 'coolDownDisplay' + (i + 1);
      coolDownDisplay.style.animation = 'none';
      coolDownDisplay.addEventListener('click', function(e) {
        if (player.inventory[this.id.slice(-1) - 1]) {
          local.quedInputs.push({
            type: 'select',
            itemIndex: this.id.slice(-1) - 1,
            id: local.inputNumber
          });
          local.inputNumber++;
        }
      });
      spellWrapper.appendChild(coolDownDisplay);
      var slotImg = createSprite('media/images/inventorySlot.png');
      slotImg.addEventListener('dragstart', function(e) {
        e.preventDefault();
      });
      slotImg.addEventListener('click', function(e) {
        if (player.inventory[this.id.slice(-1) - 1]) {
          local.quedInputs.push({
            type: 'select',
            itemIndex: this.id.slice(-1) - 1,
            id: local.inputNumber
          });
          local.inputNumber++;
        }
      });
      slotImg.id = 'inventorySlot' + (i + 1);
      slotImg.className = 'inventorySlot';
      spellWrapper.appendChild(slotImg);
    }
    var openStorage = createSprite(sprites.src.openStorage);
    openStorage.className = 'inventorySlot';
    openStorage.addEventListener('dragstart', function(e) {
      e.preventDefault();
    });
    openStorage.addEventListener('click', toggleStorage);
    spellWrapper.appendChild(openStorage);
  } else {
    for (var i = 0; i < inventory.length; i++) {
      var item = document.querySelector('#inventorySlot' + (i + 1));
      var coolDownDiv = document.querySelector('#coolDownDisplay' + (i + 1));
      coolDownDiv.style.animationDuration = inventory[i].coolDown + 'ms';
      item.src = sprites.src[inventory[i].itemName];
    }
  }
}

function storageClickHandler(e) {
  local.quedInputs.push({
    type: 'swap',
    storageIndex: e.target.id.slice(1),
    id: local.inputNumber
  });
  local.inputNumber++;
}

function fillStorage(storage) {
  var totalSlots = storageDiv.children.length;

  if (totalSlots === 0) {

    for (var i = 0; i < 10; i++) {
      var slot = document.createElement('img');
      slot.src = 'media/images/inventorySlot.png';
      slot.className = 'storageSlot';
      slot.id = 's' + i;
      slot.addEventListener('click', storageClickHandler);
      storageDiv.appendChild(slot);
    }

  }

  if (!storage) {
    return;
  }

  if (storage.length > totalSlots) {
    for (var i = 0; i < storage.length - totalSlots; i++) {
      var slot = document.createElement('img');
      slot.src = 'media/images/inventorySlot.png';
      slot.className = 'storageSlot';
      slot.id = 's' + i;
      slot.addEventListener('click', storageClickHandler);
      storageDiv.appendChild(slot);
    }
  }

  for (var i = 0; i < storage.length; i++) {
    var currentItem = storage[i];
    document.querySelector('#s' + i).src = sprites.src[currentItem.itemName];
  }
}

function toggleStorage() {
  if (storageWrapper.style.display === '') {
    storageWrapper.style.display = 'block';
  } else {
    storageWrapper.style.display = '';
  }
}

function drawLoop() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  if (state !== 'playing' || local.lastUpdate === 0) {
    return;
  }

  local.quedInputs.push({
    type: 'translate',
    facing: local.facing,
    windowWidth: innerWidth,
    windowHeight: innerHeight,
    states: local.movement,
    id: local.inputNumber
  });
  local.inputNumber++;

  if (player.unlockedSpells && player.unlockedSpells.length > 0 && !local.chosingUnlock && local.lastChosenUnlock < player.level) {
    chooseUnlockedSpells.innerHTML = '';
    local.chosingUnlock = true;
    chooseUnlockedSpellsWrapper.style.display = 'inline-block';
    for (var i = 0; i < player.unlockedSpells.length; i++) {
      var currentSpellName = player.unlockedSpells[i];

      var image = document.createElement('img');
      image.src = sprites.src[currentSpellName];
      image.id = currentSpellName;
      chooseUnlockedSpells.appendChild(image);
      image.addEventListener('click', function(e) {
        local.quedInputs.push({
          type: 'unlock',
          chosenSpell: e.target.id,
          id: local.inputNumber
        });
        local.inputNumber++;

        local.chosingUnlock = false;
        local.lastChosenUnlock++;
        chooseUnlockedSpellsWrapper.style.display = '';
      });

    }
  };

  local.player = player;

  for (var i = 0; i < local.savedInputs.length; i++) {
    var input = local.savedInputs[i];

    switch (input.type) {
      case 'translate':
        if (local.player.lastMove) {
          var dt = Date.now() - local.player.lastMove;
        } else {
          dt = 0;
        }

        var states = input.states;

        var facing = {
          x: player.x,
          y: player.y
        };

        if (states.u) {
          facing.y -= 1;
        }
        if (states.d) {
          facing.y += 1;
        }
        if (states.l) {
          facing.x -= 1;
        }
        if (states.r) {
          facing.x += 1;
        }

        var lenToFacing = distance(facing.x, facing.y, player.x, player.y);

        if (lenToFacing !== 0) {
          local.player.x += (local.player.movementSpeed / lenToFacing * (facing.x - player.x)) * dt;
          local.player.y += (local.player.movementSpeed / lenToFacing * (facing.y - player.y)) * dt;
        }

        if (player.x < 0) {
          player.x = 0;
        }
        if (player.x > game.map.width) {
          player.x = game.map.width;
        }
        if (player.y < 0) {
          player.y = 0;
        }
        if (player.y > game.map.height) {
          player.y = game.map.height;
        }

        local.player.lastMove = Date.now();
        break;
    }
  }

  grid.xOffset = -local.player.x;
  grid.yOffset = -local.player.y;

  //spell explosion areas
  if (game.effectAreas) {
    for (var i = 0; i < game.effectAreas.length; i++) {
      var area = game.effectAreas[i];
      ctx.fillStyle = area.color;
      ctx.beginPath();
      ctx.arc(localCoords(area.location.x, 'x'), localCoords(area.location.y, 'y'), area.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (var i = 0; i < game.players.length; i++) {
    var currentPlayer = game.players[i];
    if (currentPlayer.id !== player.id) {

      var lastCurrentPlayer = local.lastPlayerStates.find(function(element) {
        return (currentPlayer.id === element.id);
      });

      if (!lastCurrentPlayer) {
        continue;
      }

      var newPosition = vLerp({
        x: lastCurrentPlayer.x,
        y: lastCurrentPlayer.y
      }, {
        x: currentPlayer.x,
        y: currentPlayer.y
      }, 0.05);

      lastCurrentPlayer.x = newPosition.x;
      lastCurrentPlayer.y = newPosition.y;

      ctx.save();
      ctx.translate(localCoords(lastCurrentPlayer.x, 'x'), localCoords(lastCurrentPlayer.y, 'y'));
      ctx.rotate(currentPlayer.angle);
      ctx.drawImage(sprites.players.red, -sprites.players.red.width / 2, -sprites.players.red.height / 2);
      ctx.restore();

    }
  }

  //player
  ctx.save();
  ctx.translate(innerWidth / 2, innerHeight / 2);
  ctx.rotate(local.angle);
  ctx.drawImage(sprites.players.green, -sprites.players.green.width / 2, -sprites.players.green.height / 2);
  ctx.restore();

  //spells
  for (var i = 0; i < game.spells.length; i++) {
    var spell = game.spells[i];
    var predictedX = spell.location.x + (spell.speed / spell.lenToTarget * (spell.target.x - spell.origin.x) * (Date.now() - local.lastUpdate));
    var predictedY = spell.location.y + (spell.speed / spell.lenToTarget * (spell.target.y - spell.origin.y) * (Date.now() - local.lastUpdate));

    if (predictedX < 0) {
      predictedX = 0;
    }
    if (predictedX > game.map.width) {
      predictedX = game.map.width;
    }
    if (predictedY < 0) {
      predictedY = 0;
    }
    if (predictedY > game.map.height) {
      predictedY = game.map.height;
    }

    ctx.drawImage(sprites.effects[spell.name], localCoords(predictedX, 'x') - sprites.effects[spell.name].width / 2, localCoords(predictedY, 'y') - sprites.effects[spell.name].height / 2);
  }

  if (player.blinded) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.98)';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  }

  healthBar.style.width = 'calc(' + (player.health / player.maxHealth * 100) + '%' + ' - 8px' + ')';
  healthPercentDisplay.innerText = Math.round(player.health / player.maxHealth * 100);
  levelNumberDisplay.innerText = player.level;
  if (player.xp < 1000) {
    xpNumberDisplay.innerText = player.xp;
  } else {
    xpNumberDisplay.innerText = Math.floor(player.xp / 1000) + 'k';
  }
  xpBar.style.width = 'calc(' + (player.xp / player.levelUpAtXp * 100) + '%' + ' - 8px' + ')';

  inputs = inputs.concat(local.quedInputs); //load input que
  local.savedInputs = local.savedInputs.concat(local.quedInputs);
  local.quedInputs = [];
  socket.emit('input', inputs);
  inputs = [];
  if (state === 'playing') {
    requestAnimationFrame(drawLoop);
  }
}

addEventListener('mousemove', function(e) {
  local.angle = Math.atan2(e.pageX - innerWidth / 2, -(e.pageY - innerHeight / 2));

  local.facing = {
    x: e.pageX,
    y: e.pageY
  };
});

addEventListener('wheel', function(e) {
  if (e.ctrlKey) {
    e.preventDefault();
  }
  if (state === 'playing' && e.target.id === 'gameCanvas') {
    if (e.deltaY > 0) {
      local.quedInputs.push({
        type: 'select',
        itemIndex: player.selectedItem - 1,
        id: local.inputNumber
      });
    } else {
      local.quedInputs.push({
        type: 'select',
        itemIndex: player.selectedItem + 1,
        id: local.inputNumber
      });
    }
    local.inputNumber++;
  }
});

addEventListener('keydown', function(e) {
  var inventorySlot = document.querySelector('#inventorySlot' + e.key);
  if (inventorySlot && player.inventory[e.key - 1] && !e.repeat) {
    local.quedInputs.push({
      type: 'select',
      itemIndex: e.key - 1,
      id: local.inputNumber
    });
    local.inputNumber++;
  } else if (local.controls[e.key.toLowerCase()] && state === 'playing') {
    local.movement[local.controls[e.key.toLowerCase()]] = true;
  } else if (local.keymap[e.key.toLowerCase()] === 'toggleStorage' && state === 'playing') {
    toggleStorage();
  }
});

addEventListener('keyup', function(e) {
  if (local.controls[e.key.toLowerCase()]) {
    local.movement[local.controls[e.key.toLowerCase()]] = false;
  }
});

addEventListener('blur', function() {
  for (var key in local.controls) {
    local.movement[local.controls[key]] = false;
  }
});

function castSpell(e) {
  if (!player.inventory[player.selectedItem].cooling) {
    local.quedInputs.push({
      type: 'cast',
      id: local.inputNumber,
      mouse: {
        x: globalCoords(e.pageX, 'x'),
        y: globalCoords(e.pageY, 'y')
      }
    });
    local.inputNumber++;
    if (sounds[player.inventory[player.selectedItem].itemName].paused) {
      sounds[player.inventory[player.selectedItem].itemName].play();
    } else {
      sounds[player.inventory[player.selectedItem].itemName].pause();
      sounds[player.inventory[player.selectedItem].itemName].currentTime = 0;
      sounds[player.inventory[player.selectedItem].itemName].play();
    }
    var coolDown = document.querySelector('#coolDownDisplay' + (player.selectedItem + 1));
    setTimeout(function() {
      coolDown.style.animation = 'none';
    }, coolDown.style.animationDuration.slice(0, -2));
    coolDown.style.animation = '';
  }
}

gameCanvas.addEventListener('click', castSpell);
chooseUnlockedSpellsWrapper.addEventListener('click', function(e) {
  if (e.target.id !== 'chooseUnlockedSpells' && e.target.parentElement.id !== 'chooseUnlockedSpells') {
    castSpell(e);
  }
});

function updateLeaderboard(leaderboard) {
  if (!document.getElementById('leaderboard')) {
    leaderboardElement = document.createElement('div');
    leaderboardElement.id = 'leaderboard';

    var header = document.createElement('h4');
    header.id = 'leaderboardHeader';
    header.innerText = 'Leaderboard';

    leadersList = document.createElement('ul');
    leadersList.id = 'leadersList';

    leaderboardElement.appendChild(header);
    leaderboardElement.appendChild(leadersList);

    document.body.appendChild(leaderboardElement);
  }

  if (leaderboardElement.innerHTML === '') {
    var header = document.createElement('h4');
    header.id = 'leaderboardHeader';
    header.innerText = 'Leaderboard';

    leadersList = document.createElement('ul');
    leadersList.id = 'leadersList';

    leaderboardElement.appendChild(header);
    leaderboardElement.appendChild(leadersList);
  }

  leadersList.innerHTML = '';

  for (var i = 0; i < leaderboard.length; i++) {
    var nickname = leaderboard[i][0];
    var score = leaderboard[i][1];
    var place = leaderboard[i][2];
    var id = leaderboard[i][3];

    var playerLi = document.createElement('li');
    playerLi.className = 'playerLi';
    if (id === player.id) {
      playerLi.className += ' self';
    }
    var nicknameSpan = document.createElement('span');
    nicknameSpan.className = 'nickname';
    var scoreSpan = document.createElement('span');
    scoreSpan.className = 'score';
    var placeSpan = document.createElement('span');
    placeSpan.className = 'place';

    nicknameSpan.innerText = nickname;

    if (score < 1000) {
      scoreSpan.innerText = score;
    } else {
      scoreSpan.innerText = Math.floor(score / 1000) + 'k';
    }

    placeSpan.innerText = place + '.';

    playerLi.appendChild(placeSpan);
    playerLi.appendChild(nicknameSpan);
    playerLi.appendChild(scoreSpan);

    leadersList.appendChild(playerLi);
  }

}

lerp = function(p, n, t) {
  var t = Number(t);
  t = parseFloat((Math.max(0, Math.min(1, t))).toFixed(3));
  return parseFloat((p + t * (n - p)).toFixed(3));
};

vLerp = function(v, tv, t) {
  return {
    x: this.lerp(v.x, tv.x, t),
    y: this.lerp(v.y, tv.y, t)
  };
};

function distance(ax, ay, bx, by) {
  return (Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2)));
}