// Verificar se está na página /adm
if (window.location.pathname.endsWith("/adm/")) {

    const correctPassword = "P4r4ds";

    const modal = document.getElementById("adminModal");
    const input = document.getElementById("adminPasswordInput");
    const button = document.getElementById("adminPasswordBtn");
    const errorMsg = document.getElementById("adminError");

    modal.style.display = "flex";

    button.addEventListener("click", checkPassword);
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") checkPassword();
    });

    function checkPassword() {
        if (input.value === correctPassword) {
            modal.style.display = "none";
            errorMsg.style.display = "none";
            input.value = "";
        } else {
            errorMsg.style.display = "block";
        }
    }
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.6/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1O3YGQV1Up0n-wYXn34NyzMx0RT7NOL0",
  authDomain: "parads-list.firebaseapp.com",
  projectId: "parads-list",
  storageBucket: "parads-list.appspot.com",
  messagingSenderId: "502581426851",
  appId: "1:502581426851:web:9374424441ce1bddc71d16"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let teams = []; // Armazena os times criados
let selectedPlayer = null; // Jogador ou espaço vazio selecionado
let selectedEmptySpace = null; // Referência para o espaço vazio selecionado
let teamOnHold = null;
let backupUndo = [];

// Referência ao formulário de adicionar jogador
const playerForm = document.getElementById('playerForm');
const teamsContainer = document.getElementById('teams');
const returningTeamContainer = document.getElementById('returningTeam') //Div para exibir o time que volta
const womansRule = document.getElementById('womans');
const undoBtn = document.getElementById('undoTeams');
// const removePlayerBtn = document.getElementById('removePlayerBtn');
// const admBtn = document.getElementById('admBtn');

document.getElementById('onHold').addEventListener('change', saveTeamsToFirestore);

db.collection('teams').doc('currentTeams').onSnapshot((doc) => {
    if (doc.exists) {
        const data = doc.data();
        teams = data.teams;
        teamOnHold = data.teamOnHold;

        // Atualiza o estado do checkbox "onHold" com o valor salvo
        const isRuleActive = data.isRuleActive || false; // Define como false se não houver valor salvo
        const womansRule = data.womansRule || false;
        document.getElementById('onHold').checked = isRuleActive;
        document.getElementById('womans').checked = womansRule;
        
        // Renderizar a lista de times na página
        renderTeams();
        // saveTeamsToFirestore();
    } else {
        console.log("No teams data found!");
    }
});

// Função para salvar os times no Firestore
function saveTeamsToFirestore() {
    const teamsData = teams.map(team => ({
        players: team.players.map(player => player ? {
            name: player.name,
            isSetter: player.isSetter,
            isFemale: player.isFemale,
            wins: player.wins || 0
        } : null),
        wins: team.wins || 0
    }));

    const isRuleActive = document.getElementById('onHold').checked;
    const womansRule = document.getElementById('womans').checked;

    db.collection('teams').doc('currentTeams').get()
        .then(doc => {
            if (doc.exists) {
                const data = doc.data();
                backupUndo = data; // Faz o backup antes de salvar
            }

            return db.collection('teams').doc('currentTeams').set({
                teams: teamsData,
                teamOnHold: teamOnHold ? {
                    players: teamOnHold.players.map(player => player ? {
                        name: player.name,
                        isSetter: player.isSetter,
                        isFemale: player.isFemale,
                        wins: player.wins || 0
                    } : null),
                    wins: teamOnHold.wins || 0
                } : null,
                isRuleActive: isRuleActive,
                womansRule: womansRule
            });
        })
        .then(() => {
            console.log("Teams saved successfully!");
        })
        .catch(error => {
            console.error("Error saving teams: ", error);
        });
}

undoBtn.addEventListener('click', function () {
    if (backupUndo && Array.isArray(backupUndo.teams)) {
        reRender(backupUndo.teams, backupUndo);
    } else {
        console.warn("Sem backup disponível ou em formato inválido.");
    }
});


function handleWin(winningTeamIndex) {
    const winningTeam = teams[winningTeamIndex];
    const confirmVictory = confirm(`O time de ${winningTeam.players[0].name} GANHOU! O Time perdedor irá para o final da lista.`)

    if(confirmVictory) {
        winningTeam.wins = (winningTeam.wins || 0) + 1;

        winningTeam.players.forEach(player => {
            if (player) {
                player.wins = (player.wins || 0) + 1; // Incrementa vitórias do jogador
            }
        });
    
        const losingTeamIndex = winningTeamIndex === 0 ? 1 : 0;
        const losingTeam = teams[losingTeamIndex];
        redistributeLosingTeam(losingTeam);
    
        const isRuleActive = document.getElementById('onHold').checked;
        if (isRuleActive) {
            if (teamOnHold) {
                const teamReturning = teamOnHold;
                teamOnHold = null;
                teamReturning.wins = 0;
                teams.splice(losingTeamIndex, 1);
                teams.unshift(teamReturning);
            } else {
                teams.splice(losingTeamIndex, 1);
                if (winningTeam.wins >= 2) {
                    teamOnHold = winningTeam;
                    teams.splice(teams.indexOf(winningTeam), 1);
                    winningTeam.wins = 0;
                }
            }
        } else {
            teams.splice(losingTeamIndex, 1);
        }
    }

    renderTeams();
    saveTeamsToFirestore();
}

womansRule.addEventListener('click', saveTeamsToFirestore);


function selectPlayer(player, playerElement) {
    if (selectedPlayer) {
        if (selectedPlayer.player === player) {
            selectedPlayer.element.classList.remove('player-selected');
            selectedPlayer = null;

            renderTeams();
            return;
        }

        const confirmSwap = confirm(`Deseja trocar ${selectedPlayer.player.name} por ${player.name}?`);
        if (confirmSwap) {
            swapPlayers(selectedPlayer.player, player);
            selectedPlayer.element.classList.remove('player-selected');
            selectedPlayer = null;
            renderTeams();
        } else {
            selectedPlayer.element.classList.remove('player-selected');
            selectedPlayer = null;
            renderTeams();
        }

        return;
    }

    if (selectedEmptySpace) {
        selectedEmptySpace.element.classList.remove('player-empty-selected');
        selectedEmptySpace = null;
    }

    selectedPlayer = { player: player, element: playerElement };
    playerElement.classList.add('player-selected');
}

// Função para trocar jogadores
function swapPlayers(playerA, playerB) {
    const teamAIndex = teams.findIndex(team => team.players.includes(playerA));
    const teamBIndex = teams.findIndex(team => team.players.includes(playerB));

    const playerAIndex = teams[teamAIndex].players.indexOf(playerA);
    const playerBIndex = teams[teamBIndex].players.indexOf(playerB);

    teams[teamAIndex].players[playerAIndex] = playerB;
    teams[teamBIndex].players[playerBIndex] = playerA;
    saveTeamsToFirestore();
}

// Função para selecionar um espaço vazio
function selectEmptySpace(playerElement, teamIndex, playerIndex) {
    if (selectedEmptySpace) {
        selectedEmptySpace.element.classList.remove('player-empty-selected');
    }

    if (selectedPlayer) {
        selectedPlayer.element.classList.remove('player-selected');
        selectedPlayer = null;
    }

    selectedEmptySpace = { element: playerElement, teamIndex: teamIndex, playerIndex: playerIndex };
    playerElement.classList.add('player-empty-selected');

    renderTeams();
}

// Função para adicionar jogador ao time
function addPlayerToTeam(player) {
    player.wins = player.wins || 0;

    if (selectedEmptySpace) {
        const team = teams[selectedEmptySpace.teamIndex];
        team.players[selectedEmptySpace.playerIndex] = player;

        selectedEmptySpace.element.classList.remove('player-empty-selected');
        selectedEmptySpace = null;
    } else {
        for (let team of teams) {
            if (canAddPlayerToTeam(team, player)) {
                team.players.push(player);
                return;
            }
        }

        const newTeam = { players: [] };
        newTeam.players.push(player);
        teams.push(newTeam);
    }
}

// Função para verificar se o jogador pode ser adicionado a um time
function canAddPlayerToTeam(team, player) {
    const isSetterInTeam = team.players.some(p => p && p.isSetter);
    const isFemaleInTeam = team.players.some(p => p && p.isFemale);
    const countFemaleInTeam = team.players.filter(p => p && p.isFemale).length;

    const teamNotFull = team.players.length < 6;

    if (!teamNotFull) return false;
    if (player.isSetter && isSetterInTeam) return false;
    if(womansRule.checked) {
        if (player.isFemale && countFemaleInTeam >= 2) return false;
    } else {
        if (player.isFemale && isFemaleInTeam) return false;
    }

    return true;
}

// Função para adicionar jogador ao formulário
playerForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const playerName = document.getElementById('playerName').value;
    const isSetter = document.getElementById('isSetter').checked;
    const isFemale = document.getElementById('isFemale').checked;

    const newPlayer = {
        name: playerName,
        isSetter: isSetter,
        isFemale: isFemale
    };

    addPlayerToTeam(newPlayer);
    renderTeams();

    // Limpar formulário
    playerForm.reset();
    saveTeamsToFirestore();
});

// Detecta cliques fora dos jogadores e espaços vazios para desmarcar seleção
// document.addEventListener('click', function () {
//     // Desmarcar jogador selecionado
//     if (selectedPlayer) {
//         selectedPlayer.element.classList.remove('player-selected');
//         selectedPlayer = null;
//     }

//     // Desmarcar espaço vazio selecionado
//     if (selectedEmptySpace) {
//         selectedEmptySpace.element.classList.remove('player-empty-selected');
//         selectedEmptySpace = null;
//     }

//     // Esconder o botão de remover se nenhum jogador estiver selecionado
//     document.getElementById('removePlayerBtn').style.display = 'none';
// });

// Função para redistribuir o time perdedor
function redistributeLosingTeam(losingTeam) {
    let remainingPlayers = []; // Armazena os 4 jogadores não levantadores nem mulheres
    let setter = null; // Levantador do time
    let femalePlayer = null; // Mulher do time

    // Classificar os jogadores do time
    losingTeam.players.forEach(player => {
        if (player) {
            if (player.isSetter) {
                setter = player;
            } else if (player.isFemale) {
                femalePlayer = player;
            } else {
                remainingPlayers.push(player);
            }
        }
    });

    // Realocar o levantador
    if (setter) {
        realocatePlayer(setter);
    }

    // Realocar a mulher
    if (femalePlayer) {
        realocatePlayer(femalePlayer);
    }

    // Embaralhar os 4 jogadores restantes
    remainingPlayers = shuffleArray(remainingPlayers);

    // Realocar os jogadores restantes aleatoriamente
    remainingPlayers.forEach(player => {
        realocatePlayer(player);
    });
    saveTeamsToFirestore();
}

// Função para realocar um jogador em um time disponível
function realocatePlayer(player) {
    for (let team of teams) {
        if (canAddPlayerToTeam(team, player)) {
            for (let i = 0; i < 6; i++) {
                if (!team.players[i]) {
                    team.players[i] = player;
                    return;
                }
            }
        }
    }

    // Se não encontrar time, cria um novo time
    const newTeam = { players: [] };
    newTeam.players.push(player);
    teams.push(newTeam);
    saveTeamsToFirestore();
}

// Função auxiliar para embaralhar array (usado para os 4 jogadores restantes)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Função auxiliar para criar botão de vitória
function createWinButton(teamIndex) {
    const winButton = document.createElement('button');
    winButton.textContent = 'Venceu';
    winButton.classList.add('win-button');
    winButton.addEventListener('click', function () {
        handleWin(teamIndex);
    });
    return winButton;
}

// Atualização da função que cria a interface dos times
function createTeamElement(team, title, teamIndex = null) {
    const teamDiv = document.createElement('div');
    teamDiv.classList.add('team');

    const teamTitle = document.createElement('h3');
    teamTitle.textContent = title;
    teamDiv.appendChild(teamTitle);

    const playerList = document.createElement('div');
    playerList.style.display = 'flex';
    playerList.style.flexDirection = 'column';

    for (let i = 0; i < 6; i++) {
        const playerItem = document.createElement('div');
        playerItem.classList.add('player-space');

        if (team.players[i]) {
            const player = team.players[i];
            const playerName = `${player.name}`;
            const tagP = document.createElement('p');
            tagP.textContent = playerName;
            const tagSpan = document.createElement('span');
            tagSpan.textContent = `${player.wins}`

            const btnDelete = document.createElement('button');
            btnDelete.textContent = '✖'
            btnDelete.id = 'removePlayerBtn';

            playerItem.appendChild(tagP);
            playerItem.appendChild(tagSpan)
            playerItem.appendChild(btnDelete);


            if (player.isSetter) playerItem.classList.add('player-setter');
            if (player.isFemale) playerItem.classList.add('player-female');
            playerItem.addEventListener('click', function (event) {
                event.stopPropagation();
                selectPlayer(player, playerItem);
                tagSpan.style.display = 'none'

                btnDelete.id = 'removePlayerBtnShow'
                btnDelete.addEventListener('click', function() {
                    const confirmDelete = confirm(`Deseja remover ${player.name}?`);

                    if (confirmDelete) {
                        if (selectedPlayer) {
                            for (let team of teams) {
                                const playerIndex = team.players.indexOf(selectedPlayer.player);
                                
                                if (playerIndex !== -1) {
                                    team.players.splice(playerIndex, 1);
                                    selectedPlayer = null;
                                    break;
                                }
                            }
                    
                            selectedPlayer = null;
                            this.style.display = 'none';
                    
                            setTimeout(() => {
                                selectedPlayer = null;
                            }, 100);
                        }


                        renderTeams();
                        saveTeamsToFirestore();
                    }
                })
            });
        } else {
            playerItem.textContent = 'ʕ•́ᴥ•̀ʔっ';
            playerItem.classList.add('player-empty');
            playerItem.addEventListener('click', function (event) {
                event.stopPropagation();
                selectEmptySpace(playerItem, teams.indexOf(team), i);
            });
            if (selectedEmptySpace && selectedEmptySpace.teamIndex === teams.indexOf(team) && selectedEmptySpace.playerIndex === i) {
                playerItem.classList.add('player-empty-selected');
            }
        }
        playerList.appendChild(playerItem);
    }

    teamDiv.appendChild(playerList);
    if (teamIndex === 0 || teamIndex === 1) {
        const winButton = createWinButton(teamIndex);
        teamDiv.appendChild(winButton);
    }

    return teamDiv;
}

function reRender(test, backupData = null) {
    teams = test.map(team => ({
        players: team.players.map(player => player ? { ...player } : null),
        wins: team.wins || 0
    }));

    if (backupData && backupData.teamOnHold) {
        teamOnHold = {
            players: backupData.teamOnHold.players.map(player => player ? { ...player } : null),
            wins: backupData.teamOnHold.wins || 0
        };
    } else {
        teamOnHold = null;
    }

    renderTeams();
    saveTeamsToFirestore();
}


// Função para renderizar os times atualizada com os botões "Venceu"
function renderTeams() {
    teamsContainer.innerHTML = '';
    teams = teams.filter(team => team.players.some(player => player));

    if (teamOnHold) {
        const returningTeamDiv = createTeamElement(teamOnHold, 'Volta');
        returningTeamContainer.innerHTML = ''; // Limpa o container do time "Volta"
        returningTeamContainer.appendChild(returningTeamDiv);
    } else {
        returningTeamContainer.innerHTML = ''; // Limpa se não houver time em espera
    }

    if (teams.length > 0) {
        const playingTeamsContainer = document.createElement('div');
        playingTeamsContainer.classList.add('playing-teams');

        const team1Div = createTeamElement(teams[0], 'Time 1', 0);
        const team2Div = teams.length > 1 ? createTeamElement(teams[1], 'Time 2', 1) : null;

        playingTeamsContainer.appendChild(team1Div);

        if (team2Div) {
            playingTeamsContainer.appendChild(team2Div);
        }

        teamsContainer.appendChild(playingTeamsContainer);
    }

    // Renderiza os outros times, se existirem
    for (let i = 2; i < teams.length; i++) {
        const teamTitle = `${i - 1}º Próxima`;
        const teamDiv = createTeamElement(teams[i], teamTitle);
        teamsContainer.appendChild(teamDiv);
    }
}

// Adicionando o evento para o botão de popular times
document.getElementById('clearTeams').addEventListener('click', clearTeams)
// document.getElementById('populateTeamsButton').addEventListener('click', populateTeams)


function populateTeams() {
    mockPlayers.forEach(player => {
        addPlayerToTeam(player);
    });
    renderTeams();
    saveTeamsToFirestore();
}

function clearTeams() {
    const confirmClear = confirm('Deseja limpar os times?');
    if (confirmClear) {
        teams = []
        renderTeams();
        teamOnHold = null;
        saveTeamsToFirestore();
    }
}

// ##########################

// if (localStorage.getItem("isAdmin") !== "true") {
//     window.location.href = "index.html";
// }

// if (window.location.pathname.endsWith("/adm")) {
//     // Solicita senha
//     const correctPassword = "P4r4ds"; // Defina uma senha segura
//     const userPassword = prompt("Por favor, insira a senha de administrador");

//     // Verifica se a senha está correta
//     if (userPassword !== correctPassword) {
//         // Se a senha estiver errada, redireciona para a página inicial ou qualquer outra página
//         alert("Senha incorreta! Redirecionando para a página inicial.");
//         window.location.href = "/"; // Substitua com a URL desejada
//     }
// }