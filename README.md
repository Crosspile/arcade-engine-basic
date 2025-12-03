# Basic Arcade Game Engine

A lightweight and flexible 2D/3D game engine for creating grid-based arcade games in the browser. Built with **Three.js**, **TypeScript**, and **RxJS**, it provides a clean architecture that separates game logic from rendering, allowing for rapid development and easy customization.

![Engine Screenshot](https://raw.githubusercontent.com/Crosspile/arcade-engine-basic/main/docs/screenshot.png)

## ✨ Features

- **Hybrid 2D/3D Rendering:** Uses Three.js to render games on a 2D grid with the ability to instantly switch to a 3D perspective camera.
- **Reactive Architecture:** Powered by RxJS, the engine uses observables to communicate state changes from the game logic (`GameModel`) to the renderer, ensuring a decoupled and maintainable codebase.
- **Reusable Game Logic:** The core renderer is independent of any specific game's rules. Create your own game by extending the `GameModel` class.
- **Dynamic Object Management:** Efficiently creates, updates, and destroys game objects with smooth animations via TWEEN.js.
- **3D UI / HUD:** In-world 3D menu and heads-up display for score, game status, and interactive buttons.
- **Built-in Effects:** Comes with a particle manager for explosions and a sound emitter for audio feedback.
- **Input Handling:** Includes an input manager that translates screen clicks into grid coordinates.
- **Debug-Friendly:** Provides visual helpers for grids and cameras to simplify development.

## 🏛️ Core Concepts

The engine is built around two primary components:

### `GameRenderer`
The heart of the engine, responsible for all visual output. It subscribes to a `GameModel` and handles:
- Setting up the Three.js scene, cameras, and lights.
- Rendering game items (pieces, blocks) based on the state received from the `GameModel`.
- Managing the game's main animation loop.
- Handling user input and translating it into game-world coordinates.
- Displaying the UI and particle effects.

### `GameModel`
An abstract class that defines the "rules" of a game. To create a new game, you extend `GameModel` and implement its core logic. It is responsible for:
- Managing the game board state (the grid of items).
- Handling game status (e.g., 'READY', 'PLAYING', 'GAME OVER').
- Calculating the score.
- Emitting state changes, effects, and score updates through RxJS `Subjects`.

## 🚀 Getting Started

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Crosspile/arcade-engine-basic.git
    cd arcade-engine-basic/src
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

This will start the demo application, which you can view in your browser.