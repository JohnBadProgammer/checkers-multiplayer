const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Avisa o servidor para liberar o seu HTML para quem acessar
app.use(express.static(__dirname));

// Quando alguém entra no site...
io.on('connection', (socket) => {
    console.log('🟢 Um jogador conectou! ID:', socket.id);

    // Quando o jogador sai do site...
    socket.on('disconnect', () => {
        console.log('🔴 Jogador desconectou:', socket.id);
    });
});

// Liga o servidor na porta 3000
server.listen(3000, () => {
    console.log('🚀 Servidor rodando! Abra seu navegador e acesse: http://localhost:3000');
});