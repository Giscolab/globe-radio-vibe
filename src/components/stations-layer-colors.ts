import * as THREE from "three";

// Extended genre colors matching the full taxonomy
export const GENRE_COLORS: Record<string, THREE.Color> = {
  pop: new THREE.Color(0xff6b9d), // Pink
  rock: new THREE.Color(0xff4444), // Red
  jazz: new THREE.Color(0x9b59b6), // Purple
  classical: new THREE.Color(0x3498db), // Blue
  electronic: new THREE.Color(0x00ff88), // Green neon
  hiphop: new THREE.Color(0xf39c12), // Orange
  country: new THREE.Color(0xcd853f), // Peru/Brown
  world: new THREE.Color(0x1abc9c), // Teal
  news: new THREE.Color(0x7f8c8d), // Gray
  sports: new THREE.Color(0x27ae60), // Green
  religious: new THREE.Color(0xe8d5b7), // Beige
  oldies: new THREE.Color(0xd4a574), // Tan/Vintage
  other: new THREE.Color(0x95a5a6), // Light gray
};

// For UI legend display
export const GENRE_COLOR_HEX: Record<string, string> = {
  pop: "#ff6b9d",
  rock: "#ff4444",
  jazz: "#9b59b6",
  classical: "#3498db",
  electronic: "#00ff88",
  hiphop: "#f39c12",
  country: "#cd853f",
  world: "#1abc9c",
  news: "#7f8c8d",
  sports: "#27ae60",
  religious: "#e8d5b7",
  oldies: "#d4a574",
  other: "#95a5a6",
};
