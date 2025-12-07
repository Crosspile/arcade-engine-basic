
import { GAME_REGISTRY } from '../GameRegistry';

export class GameInfo {
    private element: HTMLDivElement;
    private gameNameElement: HTMLHeadingElement;

    constructor() {
        this.element = document.createElement('div');
        this.element.className = "absolute top-5 left-5 z-40 pointer-events-none";

        const title = document.createElement('h1');
        title.className = "m-0 text-cyan-400 text-lg uppercase tracking-widest font-bold shadow-black drop-shadow-md";
        title.textContent = "Arcade Engine";

        this.gameNameElement = document.createElement('h2');
        this.gameNameElement.className = "text-white/60 text-xs font-mono mt-1 uppercase tracking-wider";

        const versionDiv = document.createElement('div');
        versionDiv.className = "mt-1 text-[10px] text-gray-500 font-mono";
        versionDiv.textContent = "v1.0.0";

        this.element.appendChild(title);
        this.element.appendChild(this.gameNameElement);
        this.element.appendChild(versionDiv);
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public update(state: { gameId: string }): void {
        const gameName = GAME_REGISTRY[state.gameId]?.name || 'Unknown Game';
        this.gameNameElement.textContent = gameName;
    }
}
