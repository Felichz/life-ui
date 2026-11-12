import fs from "fs";
import path from "path";

/**
 * A localStorage kept in a file, so a simulated conversation survives between
 * runs the way it does between launches of the app. It has to exist before
 * any module of the app is evaluated: this file is imported first.
 */
const dir = path.resolve(process.env.SIM_DIR ?? ".sim", process.argv[2] ?? "default");
const file = path.join(dir, "storage.json");

let data: Record<string, string> = {};
try {
  data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>;
} catch {
  // a new session
}

const save = () => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data), "utf8");
};

Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = String(value);
      save();
    },
    removeItem: (key: string) => {
      delete data[key];
      save();
    },
    clear: () => {
      data = {};
      save();
    },
  },
});

export const sessionDir = dir;
