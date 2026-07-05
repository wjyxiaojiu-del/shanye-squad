import './style/main.css';
import { Game } from './core/Game';

const mount = document.getElementById('app');
if (!mount) throw new Error('#app 挂载点不存在');

const game = new Game(mount);
game.start();
