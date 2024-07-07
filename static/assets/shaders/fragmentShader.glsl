uniform vec3 u_colorA;
uniform vec3 u_colorB;
varying float vZ;


void main() {
  vec3 color = mix(u_colorA, u_colorB, vZ * 3.0 + 0.8); 
  gl_FragColor = vec4(color, 1.0);
}
