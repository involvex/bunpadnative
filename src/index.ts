import { MainWindow } from "./app/window";
import { runMessagePump } from "./loop/messageLoop";

const win = MainWindow.create({
  title: "BunPad Native",
  width: 1024,
  height: 768,
});

let running = true;
win.onClose = () => {
  running = false;
};

console.log("BunPad Native — Phase 2");

await runMessagePump(() => running, win.pumpContext);
win.destroy();
