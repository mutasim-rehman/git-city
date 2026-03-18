export type InputSnapshot = {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1
  handbrake: boolean;
  exit: boolean;
};

type KeyMap = {
  throttle: string[];
  brake: string[];
  steerLeft: string[];
  steerRight: string[];
  handbrake: string[];
  exit: string[];
};

const DEFAULT_KEYMAP: KeyMap = {
  throttle: ["KeyW", "ArrowUp"],
  brake: ["KeyS", "ArrowDown"],
  steerLeft: ["KeyA", "ArrowLeft"],
  steerRight: ["KeyD", "ArrowRight"],
  handbrake: ["Space"],
  exit: ["Escape"],
};

export class InputManager {
  private keys: Record<string, boolean> = {};
  private keymap: KeyMap;
  private exitRequested = false;

  constructor(keymap: Partial<KeyMap> = {}) {
    this.keymap = { ...DEFAULT_KEYMAP, ...keymap };
  }

  attach() {
    const onKeyDown = (e: KeyboardEvent) => {
      this.keys[e.code] = true;
      if (this.keymap.exit.includes(e.code)) this.exitRequested = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }

  consumeSnapshot(): InputSnapshot {
    const pressed = (codes: string[]) => codes.some((c) => this.keys[c]);

    const throttle = pressed(this.keymap.throttle) ? 1 : 0;
    const brake = pressed(this.keymap.brake) ? 1 : 0;
    const steerLeft = pressed(this.keymap.steerLeft) ? 1 : 0;
    const steerRight = pressed(this.keymap.steerRight) ? 1 : 0;
    const steer = steerLeft - steerRight;
    const handbrake = pressed(this.keymap.handbrake);

    const exit = this.exitRequested;
    this.exitRequested = false;

    return { throttle, brake, steer, handbrake, exit };
  }
}

