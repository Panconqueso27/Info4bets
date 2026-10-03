import '@fontsource/press-start-2p';
import '@fontsource/vt323';
import { render } from 'preact';
import { restoreNativeSave } from './platform/save';
import { createGame } from './scene/CityScene';
import { App } from './ui/App';
import './ui/fonts.css';
import './ui/styles.css';

const root = document.getElementById('app')!;
const stage = document.createElement('div');
stage.id = 'stage';
const ui = document.createElement('div');
ui.id = 'ui';
root.append(stage, ui);

// Esperamos la fuente de píxeles para que la escena la use desde el principio.
document.fonts.load('8px "Press Start 2P"').finally(() => {
  const game = createGame(stage);
  if (import.meta.env.DEV) (window as any).__game = game;
});
// En la app, la partida guardada en el almacenamiento nativo se recupera antes de mostrar nada.
restoreNativeSave().finally(() => render(<App />, ui));
