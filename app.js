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

	// Helper to emulate __dirname in ES modules
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);

	app.get('/', (req, res) => {
		res.sendFile(path.resolve(__dirname, 'static/index.html'));
	});

	io.on('connection', (socket) => {
		console.log(`A user connected ${socket.id}`);

		socket.on('disconnect', () => {
			console.log(`user disconnected ${socket.id}`);
		});
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
