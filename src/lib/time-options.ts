import { CLOSE_MIN, OPEN_MIN, STEP_MIN } from "./config";
import { toHHmm } from "./time";

/** "07:00", "07:30", ... "21:00" */
export const TIME_OPTIONS = Array.from({ length: (CLOSE_MIN - OPEN_MIN) / STEP_MIN + 1 }, (_, i) =>
  toHHmm(OPEN_MIN + i * STEP_MIN),
);
