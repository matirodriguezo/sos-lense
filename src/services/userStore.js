let currentAlias = null;
let shiftStart = null;

export function setCurrentAlias(alias) {
  currentAlias = alias;
}

export function getCurrentAlias() {
  return currentAlias;
}

export function setShiftStart(time) {
  shiftStart = time;
}

export function getShiftStart() {
  return shiftStart;
}
