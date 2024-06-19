import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'lil-gui';
import vShader from './assets/shaders/vShader.glsl';
import fShader from './assets/shaders/fShader.glsl';
import soundTrack from './assets/audio/synth1.mp3';
import redTrack from './assets/audio/redTrack.mp3';
import yellowTrack from './assets/audio/yellowTrack.mp3';
import winTone from './assets/audio/winTone.mp3';
import drawTone from './assets/audio/drawTone.mp3';

const socket = io.connect();

let roomId = null;

// Calls init() on load
document.addEventListener(
	'DOMContentLoaded',
	() => {
		socket.emit('create new game');
	},
	false
);

/*----- DOM Elements -----*/
const player1_TurnToken = document.querySelector('.player1_token');
const player2_TurnToken = document.querySelector('.player2_token');

const musicBtn = document.querySelector('.music');
const startResetBtn = document.querySelector('.start_reset');
const winLoseDrawMsg = document.querySelector('.win_lose_draw');
const joinRoomBtn = document.querySelector('.join_room');

const column0 = document.getElementsByClassName('column0');
const column1 = document.getElementsByClassName('column1');
const column2 = document.getElementsByClassName('column2');
const column3 = document.getElementsByClassName('column3');
const column4 = document.getElementsByClassName('column4');
const column5 = document.getElementsByClassName('column5');
const column6 = document.getElementsByClassName('column6');

/*----- State Variables -----*/
let gameBoard = [];
// 2D Matrix - 6 x 7, after init() gameBoard filled with 0s to represent empty/blank cells
// [
//     [0,0,0,0,0,0,0] = gameBoard[0]
//     [0,0,0,0,0,0,0] = gameBoard[1]
//     [0,0,0,0,0,0,0] = gameBoard[3]
//     [0,0,0,0,0,0,0] = gameBoard[4]
//     [0,0,0,0,0,0,0] = gameBoard[5]
//     [0,0,0,0,0,0,0] = gameBoard[6]
// ]

let winner = false;
let draw = false;

let player1_Turn = true;
let player2_Turn = false;

const rowHeight = 6;
const columnLength = 7;

let lastColumnClicked = [];

let soundTrackPlaying = false;
let music = new Audio(soundTrack);
music.loop = true;
music.volume = 0.7;
let yellowSound = new Audio(yellowTrack);
yellowSound.loop = false;
yellowSound.volume = 0.3;
let redSound = new Audio(redTrack);
redSound.loop = false;
redSound.volume = 0.3;
let winSound = new Audio(winTone);
winSound.loop = false;
winSound.volume = 0.5;
let drawSound = new Audio(drawTone);
drawSound.loop = false;
drawSound.volume = 0.5;
let allColumns = [
	column0,
	column1,
	column2,
	column3,
	column4,
	column5,
	column6,
];

/*-----Event Listeners-----*/
startResetBtn.addEventListener('click', () => {
	socket.emit('create new game');
});
musicBtn.addEventListener('click', playMusic);
joinRoomBtn.addEventListener('click', joinRoom);

socket.emit('clear game board');
socket.on('clear board', () => {
	clearGameBoard();
});

socket.on('new game', () => {
	//roomId = data.roomId;
	init();
});

socket.on('token dropped', (data) => {
	const { cellIdx, columnIdxClicked, indexToUpdate } = data;
	dropToken(cellIdx, columnIdxClicked, indexToUpdate);
	console.log('Token dropped on CLIENT!!)');
});

function joinRoom() {
	roomId = document.getElementById('roomId').value;
	socket.emit('join room', { roomId });
}

// Adds eventListener on each cell
for (const column of allColumns) {
	for (const cell of column) {
		cell.addEventListener('click', (e) => {
			// Gets specific clicked cell (an array of [Row, Column])
			const cellIdx = getCellIdx(e);
			// Gets Column index from that array
			const columnIdxClicked = cellIdx[1];
			// Returns an Index of lowest available slot if any
			let indexToUpdate = getAvailableSlot(columnIdxClicked);

			socket.emit('drop token', {
				cellIdx,
				columnIdxClicked,
				indexToUpdate,
			});
		});
	}
}

// Sets initial state variables
function init() {
	startResetBtn.innerText = 'Restart Game?';
	clearGameBoard();

	// Initialize 2D matrix of (0)s
	for (let i = 0; i < 6; i++) {
		gameBoard.push(new Array(7).fill(0));
	}
}

//aka handleClick, fires when a column/cell is clicked
function dropToken(cellIdx, columnIdxClicked, indexToUpdate) {
	// We record the player's move to gameBoard at the lowest available slot
	gameBoard[indexToUpdate[0]][indexToUpdate[1]] = checkPlayerTurn();
	// We save this cellIdx in a global variable to later be used in the render function to color red or yellow (over-written each click)
	lastColumnClicked = [indexToUpdate[0], indexToUpdate[1]];
	render();
}

function render() {
	//Colors each cell based on player's move
	updateDomGameBoard();
	updateTurn();

	//Renders a display message if there's a Winner or a Draw
	winLoseDrawMsg.innerText = displayEndMessage(checkWinner(), checkDraw());
	if (winner == true || draw == true) {
		winLoseDrawMsg.classList.remove('endGameMsgDisable');
		playSoundFX();
		startResetBtn.innerText = `Play again?`;
	}
}

function updateDomGameBoard() {
	// We construct the classNames of appropriate Idx from the lastColumnClicked
	let classNames = [
		`row${lastColumnClicked[0]}`,
		`column${lastColumnClicked[1]}`,
	];
	// We use those 2 classNames to grab the correct DOM element/cell
	let cellToColor = document.getElementsByClassName(
		`${classNames[0]} ${classNames[1]}`
	);
	// Color that cell based on player's turn
	if (player1_Turn) {
		cellToColor[0].classList.add('red');
	} else {
		cellToColor[0].classList.add('yellow');
	}
	// Play Sci-fi sound on color change
	playSoundFX();
}

// Takes 2 functions as arguments, functions indicate winner or draw
function displayEndMessage(winner, draw) {
	if (winner) {
		if (winner[0] == 1) {
			//Highlights winning 4 cells in blue if there is a winner
			highlightWinner(winner);
			return `Player 1 WINS!!`;
		} else if (winner[0] == -1) {
			highlightWinner(winner);
			return `Player 2 WINS!!`;
		}
	} else if (draw) {
		return `DRAW! Play again?`;
	}
}

// Called by displayEndMessage(), indicates if there is a draw or not
function checkDraw() {
	// check if we have no 0s in gameBoard AND no winner
	let checkNums = [];
	// Collects all current gameBoard cell info into an array
	for (let i = rowHeight - 1; i > -1; i--) {
		for (let j = columnLength - 1; j > -1; j--) {
			checkNums.push(gameBoard[i][j]);
		}
	}
	if (!checkNums.includes(0) && winner == false) {
		draw = true;
		return true;
	} else {
		return false;
	}
}

// Called by displayEndMessage(), indicates if there is a winner by finding 4 identical cells in a row
function checkWinner() {
	/*-----Horizontal Check-----*/
	// Check every single row...
	for (let i = 0; i < rowHeight; i++) {
		// Then check the first 4 cells in the row (no need to check past column 4 cause grid is not that large)
		for (let j = 0; j < columnLength - 3; j++) {
			// If four sequential cells add up to either -4 (player 2) or 4 (player 1), we have a winner
			if (
				gameBoard[i][j] +
					gameBoard[i][j + 1] +
					gameBoard[i][j + 2] +
					gameBoard[i][j + 3] ==
					-4 ||
				gameBoard[i][j] +
					gameBoard[i][j + 1] +
					gameBoard[i][j + 2] +
					gameBoard[i][j + 3] ==
					4
			) {
				winner = true;
				// returns -1 or 1 to indicate winner, AND an array of Indexs to later highLightWinner()
				return [
					gameBoard[i][j],
					`${i}${j}`,
					`${i}${j + 1}`,
					`${i}${j + 2}`,
					`${i}${j + 3}`,
				];
			}
		}
	}

	/*-----Vertical Check-----*/
	for (let i = 0; i < rowHeight - 3; i++) {
		for (let j = 0; j < columnLength; j++) {
			if (
				gameBoard[i][j] +
					gameBoard[i + 1][j] +
					gameBoard[i + 2][j] +
					gameBoard[i + 3][j] ==
					-4 ||
				gameBoard[i][j] +
					gameBoard[i + 1][j] +
					gameBoard[i + 2][j] +
					gameBoard[i + 3][j] ==
					4
			) {
				winner = true;
				return [
					gameBoard[i][j],
					`${i}${j}`,
					`${i + 1}${j}`,
					`${i + 2}${j}`,
					`${i + 3}${j}`,
				];
			}
		}
	}

	/*-----Diagonal Check (top-left to bottom-right) -----*/
	for (let i = 3; i < rowHeight; i++) {
		for (let j = 0; j < columnLength - 2; j++) {
			if (
				gameBoard[i][j] +
					gameBoard[i - 1][j + 1] +
					gameBoard[i - 2][j + 2] +
					gameBoard[i - 3][j + 3] ==
					-4 ||
				gameBoard[i][j] +
					gameBoard[i - 1][j + 1] +
					gameBoard[i - 2][j + 2] +
					gameBoard[i - 3][j + 3] ==
					4
			) {
				winner = true;
				return [
					gameBoard[i][j],
					`${i}${j}`,
					`${i - 1}${j + 1}`,
					`${i - 2}${j + 2}`,
					`${i - 3}${j + 3}`,
				];
			}
		}
	}

	/*-----Diagonal Check (top-right to bottom-left) -----*/
	for (let i = 0; i < rowHeight - 3; i++) {
		for (let j = 0; j < columnLength - 2; j++) {
			if (
				gameBoard[i][j] +
					gameBoard[i + 1][j + 1] +
					gameBoard[i + 2][j + 2] +
					gameBoard[i + 3][j + 3] ==
					-4 ||
				gameBoard[i][j] +
					gameBoard[i + 1][j + 1] +
					gameBoard[i + 2][j + 2] +
					gameBoard[i + 3][j + 3] ==
					4
			) {
				winner = true;
				return [
					gameBoard[i][j],
					`${i}${j}`,
					`${i + 1}${j + 1}`,
					`${i + 2}${j + 2}`,
					`${i + 3}${j + 3}`,
				];
			}
		}
	}
}

// Accepts an array of winning Indexs from checkWinner()
function highlightWinner(winningFour) {
	// We remove 1st element (not needed)
	winningFour.shift();
	// We get the classNames of the winning cells
	winningFour.forEach((cell) => {
		let winningCellClassNames = [`row${cell[0]}`, `column${cell[1]}`];
		// We grab the correct DOM cell based on those classes
		let cellToHighlight = document.getElementsByClassName(
			`${winningCellClassNames[0]} ${winningCellClassNames[1]} `
		);
		// We highlight winning cells by adding a css class
		cellToHighlight[0].classList.add('winningHighlight');
	});
}

// Resets our state variables when the init() function runs
function clearGameBoard() {
	gameBoard = [];
	winner = false;
	draw = false;
	lastColumnClicked = [];
	// Removes endGame message if it's displayed
	if (!winLoseDrawMsg.classList.contains('endGameMsgDisable')) {
		winLoseDrawMsg.classList.add('endGameMsgDisable');
	}
	// Resets game button text
	startResetBtn.innerText = `Restart Game?`;
	// Removes colored cells from DOM gameBoard
	for (const column of allColumns) {
		for (const cell of column) {
			cell.classList.remove('yellow');
			cell.classList.remove('red');
			cell.classList.remove('winningHighlight');
		}
	}
}

// Checks for available space in Column clicked,
// Returns lowest available cell if it's not full
function getAvailableSlot(columnIdxClicked) {
	// Iterates through each row of the column clicked and searches for 0 (indicating empty)
	for (let i = 5; i > -1; i--) {
		if (gameBoard[i][columnIdxClicked] == 0) {
			return [i, columnIdxClicked];
		}
	}
	// Displays an alert if column is full
	alert(`Column full, dummy.`);
}

// (e) past from dropToken(e) to getCellIdx
// Returns an array of [Row, Column]
function getCellIdx(cell) {
	// gets classList of DOM object clicked
	const classArray = cell.target.classList;
	// we can get the index of the cell from the classList
	const rowClass = classArray[1];
	const colClass = classArray[2];
	// string to int
	const rowIdx = parseInt(rowClass[3]);
	const colIdx = parseInt(colClass[6]);
	return [rowIdx, colIdx];
}

// Simply returns 1 (red) if it's player 1's turn or -1 (yellow) if player 2's
function checkPlayerTurn() {
	if (player1_Turn == true) {
		return 1; // red
	} else {
		return -1; // yellow
	}
}

// Updates the player's turn indicator on the DOM
function updateTurn() {
	if (player1_Turn == true) {
		player1_Turn = false;
		player1_TurnToken.classList.remove('red');
		player2_Turn = true;
		player2_TurnToken.classList.add('yellow');
	} else {
		player2_Turn = false;
		player2_TurnToken.classList.remove('yellow');
		player1_Turn = true;
		player1_TurnToken.classList.add('red');
	}
}

// If music button pressed, we play music!
function playMusic() {
	if (soundTrackPlaying == false) {
		music.load();
		music
			.play()
			.then(() => {
				soundTrackPlaying = true;
			})
			.catch((error) => {
				console.log(error);
			});
	} else if (soundTrackPlaying == true) {
		music.pause();
		soundTrackPlaying = false;
	}
}

// 4 SoundFXs that play at each player's turn AND at Win or Draw
function playSoundFX() {
	if (player1_Turn == true && winner == false) {
		redSound.load();
		redSound
			.play()
			.then(() => {
				// sound fx played
			})
			.catch((error) => {
				console.log(error);
			});
	} else if (player2_Turn == true && winner == false) {
		yellowSound.load();
		yellowSound
			.play()
			.then(() => {
				// sound fx played
			})
			.catch((error) => {
				console.log(error);
			});
	} else if (winner == true) {
		winSound.load();
		winSound
			.play()
			.then(() => {
				// sound fx played
			})
			.catch((error) => {
				console.log(error);
			});
	} else if (draw == true) {
		drawSound.load();
		drawSound
			.play()
			.then(() => {
				// sound fx played
			})
			.catch((error) => {
				console.log(error);
			});
	}
}

// Canvas
const canvas = document.querySelector('canvas.webgl');

// Debugging GUI
const gui = new dat.GUI({ width: 200 });

// Scene
const scene = new THREE.Scene();

// Initial Particle parameter data on page load
const parameters = {
	count: 10500,
	size: 0.022,
	radius: 5,
	forks: 13,
	curve: 1,
	randomness: 1.2,
	randomPower: 8,
	innerColor: '#00ffb3',
	outerColor: '#f1f514',
};

// Initialize variables
let geometry = null;
let material = null;
let particles = null;

// Particle generation function
const generateParticleFormation = () => {
	// When GUI is adjusted, particle generation is called again so we need to remove old particle scene
	if (particles !== null) {
		geometry.dispose();
		material.dispose();
		scene.remove(particles);
	}

	// New geometry object created from BufferGeometry class
	// Will eventually contain the vertices for our particles
	geometry = new THREE.BufferGeometry();

	// Initializing Arrays to hold attributes for our geometry (* 3 cause of x, y, z values)
	const positions = new Float32Array(parameters.count * 3);
	const colors = new Float32Array(parameters.count * 3);
	const randomness = new Float32Array(parameters.count * 3);
	const innerColor = new THREE.Color(parameters.innerColor);
	const outerColor = new THREE.Color(parameters.outerColor);
	const scales = new Float32Array(parameters.count * 1);

	// For each particle..
	for (let i = 0; i < parameters.count; i++) {
		//Access every 3 elements in array
		const i3 = i * 3;

		// Particle position calculations
		const radius = Math.random() * parameters.radius;
		// every 3rd value, [0, .33, .66 | 0, .33, .66 | 0, .33, .66]...
		// Math.PI * 2 == 1 full circle
		const forkAngle = ((i % parameters.forks) / parameters.forks) * Math.PI * 2;
		// further the particle is from center will increase the curveAngle
		const curveAngle = radius * parameters.curve;

		// create random (x,y,z) variables to use in our GUI tweaking
		// random number = (Math.pow() takes 2 args, base ^ exponent) * (either a -1 or a positive 1) * (randomness)
		const randomX =
			Math.pow(Math.random(), parameters.randomPower) *
			(Math.random() < 0.5 ? 1 : -1) *
			parameters.randomness *
			radius;
		const randomY =
			Math.pow(Math.random(), parameters.randomPower) *
			(Math.random() < 0.5 ? 1 : -1) *
			parameters.randomness *
			radius;
		const randomZ =
			Math.pow(Math.random(), parameters.randomPower) *
			(Math.random() < 0.5 ? 1 : -1) *
			parameters.randomness *
			radius;

		//
		positions[i3] = Math.cos(forkAngle) * radius * -curveAngle; // position on x
		positions[i3 + 1] = Math.sin(forkAngle) * 2; // position on z
		positions[i3 + 2] = Math.sin(forkAngle) * radius * curveAngle; // position on z

		//
		randomness[i3] = randomX;
		randomness[i3 + 1] = randomY;
		randomness[i3 + 2] = randomZ;

		// Color
		const mixedInnerOuter = innerColor.clone();
		// lerp() gets the delta value from innerColor to outerColor (between 0 and 1)
		// it then uses that delta to interpolate and mix the inner and outer color
		mixedInnerOuter.lerp(outerColor, radius / parameters.radius);

		colors[i3] = mixedInnerOuter.r;
		colors[i3 + 1] = mixedInnerOuter.g;
		colors[i3 + 2] = mixedInnerOuter.b;

		// Scale
		scales[i] = Math.random();
	}

	//Setting geometry attribute w/ BufferAttribute class which stores data (vertex, indices, colors, UVs) associated with bufferGeometry
	// We pass in an array and an integer to set the attribute
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
	geometry.setAttribute(
		'aRandomness',
		new THREE.BufferAttribute(randomness, 3)
	);

	// Shader Material - custome program written in GLSL that runs on the GPU
	// Allows us to combine many objects into a single BufferGeometry to improve performance
	material = new THREE.ShaderMaterial({
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		vertexColors: true,
		uniforms: {
			uTime: { value: 0 },
			uSize: { value: 35 * renderer.getPixelRatio() },
		},
		vertexShader: vShader,
		fragmentShader: fShader,
	});

	// Instantiating our particles!
	particles = new THREE.Points(geometry, material);
	// Add particles to scene!
	scene.add(particles);
};

// Get Aspect Window ratio
const windowSize = {
	width: window.innerWidth,
	height: window.innerHeight,
};

// Allow window and scene objects to resize on window adjustment
window.addEventListener('resize', () => {
	// Update windowSize
	windowSize.width = window.innerWidth;
	windowSize.height = window.innerHeight;

	// Update camera aspect-ratio based on window size
	camera.aspect = windowSize.width / windowSize.height;
	camera.updateProjectionMatrix();

	// Update renderer
	renderer.setSize(windowSize.width, windowSize.height);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Instantiating Camera and camera position
//4 Args for PerspectiveCamera: (fov, Aspect Ratio, near, far) — for camera frustum (the region of space in the modeled world that may appear on the screen)
const camera = new THREE.PerspectiveCamera(
	75,
	windowSize.width / windowSize.height,
	0.1,
	100
);
camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 0.897;
scene.add(camera);

// Camera controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// Tweaking parameters in GUI
const particleParameters = gui.addFolder('Particle Parameters');
particleParameters.close();
particleParameters
	.add(parameters, 'count')
	.min(100)
	.max(1000000)
	.step(100)
	.onFinishChange(generateParticleFormation);
particleParameters
	.add(parameters, 'radius')
	.min(0.01)
	.max(22)
	.step(0.01)
	.onFinishChange(generateParticleFormation);
particleParameters
	.add(parameters, 'curve')
	.min(-5)
	.max(5)
	.step(0.001)
	.onFinishChange(generateParticleFormation);
particleParameters
	.add(parameters, 'forks')
	.min(1)
	.max(20)
	.step(1.0)
	.onFinishChange(generateParticleFormation);
particleParameters
	.add(parameters, 'randomness')
	.min(0)
	.max(10)
	.step(0.001)
	.onFinishChange(generateParticleFormation);
particleParameters
	.add(parameters, 'randomPower')
	.min(1)
	.max(10)
	.step(0.001)
	.onFinishChange(generateParticleFormation);
particleParameters
	.addColor(parameters, 'innerColor')
	.onFinishChange(generateParticleFormation);
particleParameters
	.addColor(parameters, 'outerColor')
	.onFinishChange(generateParticleFormation);
const cameraFolder = gui.addFolder('Camera');
cameraFolder.add(camera.position, 'x').min(0).max(15).step(0.001);
cameraFolder.add(camera.position, 'y').min(0).max(15).step(0.001);
cameraFolder.add(camera.position, 'z').min(0.01).max(15).step(0.001);
cameraFolder.close();

// Renderer (WebGl)
const renderer = new THREE.WebGLRenderer({
	canvas: canvas,
});
renderer.setSize(windowSize.width, windowSize.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Our main function
generateParticleFormation();

// Object for keeping track of time to use in frame updates
const clock = new THREE.Clock();
// Updates objects every frame...
const frame = () => {
	const elapsedTime = clock.getElapsedTime();

	// Update material
	material.uniforms.uTime.value = elapsedTime * 0.2; // slow it down a bit...

	// Update controls
	controls.update();

	// Render
	renderer.render(scene, camera);

	// Call fram() again for the next frame
	window.requestAnimationFrame(frame);
};
frame();
