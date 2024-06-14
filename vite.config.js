import restart from 'vite-plugin-restart';
import glsl from 'vite-plugin-glsl';

export default {
	plugins: [restart({ restart: ['../static/**'] }), glsl()],
};
