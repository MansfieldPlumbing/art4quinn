export function executeCommand(cmd: string) {
  console.log('Execute:', cmd);
  // Implementation will connect to Android backend
}

type OutputCallback = (text: string) => void;
const subscribers = new Set<OutputCallback>();

export function subscribeToOutput(callback: OutputCallback) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

// For testing, expose a way to mock output
export function emitOutput(text: string) {
  subscribers.forEach(cb => cb(text));
}

export function minimizeAppFromBridge() {
  console.log('Minimize app requested');
  // Implementation for Android
}
