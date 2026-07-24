const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

// --- BANCO DE DADOS EM MEMÓRIA (Reseta ao desligar o servidor) ---
let usersDB = {};
let guildsDB = [];
let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log('🟢 Nova conexão:', socket.id);

    // --- SISTEMA DE CONTAS (AUTH) ---
    socket.on('register', (data, callback) => {
        if (usersDB[data.username]) return callback({ success: false, msg: "Este nome de usuário já está em uso." });
        
        // Cadastra o usuário no servidor
        usersDB[data.username] = {
            username: data.username,
            password: data.password, // Já chega em Hash
            displayName: data.username,
            avatar: '',
            elo: 1000,
            matchHistory: [],
            theme: 'classic'
        };
        callback({ success: true });
    });

    socket.on('login', (data, callback) => {
        let user = usersDB[data.username];
        if (user && user.password === data.password) {
            socket.username = user.username; // Vincula o socket ao usuário
            callback({ success: true, userData: user });
        } else {
            callback({ success: false, msg: "Credenciais inválidas ou usuário não existe." });
        }
    });

    socket.on('update_profile', (data) => {
        if (usersDB[data.username]) {
            usersDB[data.username].displayName = data.displayName;
            usersDB[data.username].theme = data.theme;
            usersDB[data.username].avatar = data.avatar;
        }
    });

    // --- SISTEMA DE GUILDAS ---
    socket.on('get_guilds', (callback) => {
        callback(guildsDB);
    });

    socket.on('create_guild', (data, callback) => {
        // Verifica se o nome da guilda já existe
        let exists = guildsDB.find(g => g.name.toLowerCase() === data.name.toLowerCase());
        if (exists) return callback({ success: false, msg: "Já existe uma guilda com este nome." });

        let newGuild = {
            name: data.name,
            desc: data.desc,
            eloMin: data.eloMin,
            avatar: data.avatar, // Nova foto da guilda
            maxMembers: 50,
            creator: data.creator,
            membersList: [data.creator],
            blacklist: []
        };
        guildsDB.push(newGuild);
        io.emit('guilds_updated', guildsDB); // Avisa todos os jogadores online
        callback({ success: true });
    });

    // --- SISTEMA DE PARTIDAS (MATCHMAKING) ---
    socket.on('find_match', (playerData) => {
        socket.playerData = playerData;

        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            const roomId = `room_${waitingPlayer.id}_${socket.id}`;
            waitingPlayer.join(roomId);
            socket.join(roomId);

            waitingPlayer.roomId = roomId;
            socket.roomId = roomId;

            const isFirstWhite = Math.random() < 0.5;

            waitingPlayer.emit('match_found', { roomId: roomId, color: isFirstWhite ? 1 : 2, opponent: socket.playerData });
            socket.emit('match_found', { roomId: roomId, color: isFirstWhite ? 2 : 1, opponent: waitingPlayer.playerData });

            console.log(`⚔️ Partida iniciada: ${waitingPlayer.playerData.username} vs ${socket.playerData.username}`);
            waitingPlayer = null; 
        } else {
            waitingPlayer = socket;
            socket.emit('waiting_for_opponent');
        }
    });

    // Sincronização Perfeita (Mirroring do Tabuleiro)
    socket.on('sync_state', (stateData) => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('update_board', stateData);
        }
    });

    socket.on('resign_game', () => {
        if (socket.roomId) socket.to(socket.roomId).emit('opponent_resigned');
    });

    socket.on('disconnect', () => {
        console.log('🔴 Desconectou:', socket.id);
        if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
        if (socket.roomId) socket.to(socket.roomId).emit('opponent_disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`🚀 Servidor rodando na porta ${PORT}`); });