
import { GameModel } from '../../games/GameModel';

export interface MenuContext {
    isOrtho: boolean;
    activeGame: GameModel | null;
    toggleCamera(): boolean;
}
