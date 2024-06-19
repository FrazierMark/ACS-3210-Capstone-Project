import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

const port = process.env.APP_PORT || 3010;

async function createMainServer() {
	const app = express();
	const server = http.createServer(app);
	const io = new Server(server);

	const rooms = {};
	let gameBoard;

	// Helper to emulate __dirname in ES modules
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);

	app.get('/', (req, res) => {
		res.sendFile(path.resolve(__dirname, 'static/index.html'));
	});

	io.on('connection', (socket) => {
		console.log(`A user connected: Socket ID => ${socket.id}`);

		socket.on('disconnect', () => {
			console.log(`A User disconnected: Socket ID => ${socket.id}`);
		});

		socket.on('create new game', () => {
			const roomId = createRoomId(6);
			rooms[roomId] = {};
			console.log('Created new game!!');
			// socket.join(roomId);
			io.emit('new game');
		});

		socket.on('clear game board', () => {
			io.emit('clear board');
		});

		socket.on('join game', (data) => {
			console.log("JOINED GAME")
			if (rooms[data.roomId] != null) {
				socket.join(data.roomId);
				socket.to(data.roomId).emit('player connected', {});
				io.emit('players connected');
			}
		});

		socket.on('drop token', (data) => {
			io.emit('token dropped', data);
		})

	});

	const vite = await createViteServer({
		server: {
			middlewareMode: true,
			hmr: {
				server,
			},
		},
		appType: 'spa',
	});

	app.use(vite.middlewares);

	app.use(express.static('static'));

	server.listen(port, () => {
		console.log(`App listening at http://localhost:${port}`);
	});
}

createMainServer();

function createRoomId(length) {
	var result = '';
	var characters =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var charactersLength = characters.length;
	for (var i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}
