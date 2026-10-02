import '@fontsource/press-start-2p';
import '@fontsource/vt323';
import { render } from 'preact';
import { createGame } from './scene/CityScene';
import { App } from './ui/App';
import './ui/styles.css';

const root = document.getElementById('app')!;
const stage = document.createElement('div');
stage.id = 'stage';
const ui = document.createElement('div');
ui.id = 'ui';
root.append(stage, ui);

// Esperamos la fuente de píxeles para que la escena la use desde el principio.
document.fonts.load('8px "Press Start 2P"').finally(() => createGame(stage));
render(<App />, ui);
