// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';

// The scaffold gives jsdom the MessageChannel of worker_threads for React 19's scheduler, but its ports keep Node
// alive and Jest never exits. Close them once a test file is done.
const ports = [];
global.MessageChannel = class extends global.MessageChannel {
  constructor() {
    super();
    ports.push(this.port1, this.port2);
  }
};
afterAll(() => ports.splice(0).forEach((port) => port.close()));
